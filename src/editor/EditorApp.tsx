import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { contentRegistry } from '../game/systems/ContentRegistry';
import {
  availableEncounters,
  availableLevels,
  stashForPreview,
  type WorkingLevel,
} from './levelStore';
import type { LevelEvent } from '../schemas/levelSchema';
import type { ValidationError } from '../schemas/validation';
import { IntensityStrip } from './IntensityStrip';
import { EventList } from './EventList';
import { Inspector } from './Inspector';
import { ValidationPanel } from './ValidationPanel';
import { PreviewPanel } from './PreviewPanel';
import {
  autosaveProject,
  createEditorProject,
  loadProjectAutosave,
  parseProjectPackage,
  projectDownloads,
  stashProjectForPreview,
  validateEditorProject,
  type EditorProject,
} from './projectStore';
import { ProjectHistory } from './ProjectHistory';
import { SpatialComposer } from './SpatialComposer';
import { TimelineEditor } from './TimelineEditor';
import { LevelStudioPackageSchema } from '../schemas/studioPackageSchema';
import {
  createLevelPackFromEditorProject,
  editorProjectFromLevelPack,
} from '../studio/BuiltInPackages';
import './editor.css';

type Workspace = 'spatial' | 'timeline' | 'preview';

export function EditorApp() {
  const embedded = new URLSearchParams(window.location.search).get('embedded') === '1';
  const levels = useMemo(() => availableLevels(), []);
  const encounters = useMemo(() => availableEncounters(), []);
  const contentErrors = contentRegistry.errors;
  const [levelId, setLevelId] = useState(levels[0]?.id ?? '');
  const [project, setProject] = useState<EditorProject | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [validation, setValidation] = useState<ValidationError[]>([]);
  const [importError, setImportError] = useState<string | null>(null);
  const [workspace, setWorkspace] = useState<Workspace>('spatial');
  const [historyRevision, setHistoryRevision] = useState(0);
  const fileInput = useRef<HTMLInputElement>(null);
  const history = useRef<ProjectHistory<EditorProject> | null>(null);

  const loadLevel = useCallback((id: string) => {
    const definition = contentRegistry.levels.get(id);
    if (!definition) return;
    const next = loadProjectAutosave(id) ?? createEditorProject(definition);
    history.current = new ProjectHistory(next);
    setProject(next);
    setSelectedId(null);
    setValidation([]);
    setImportError(null);
    setHistoryRevision((value) => value + 1);
  }, []);

  useEffect(() => {
    if (levelId) loadLevel(levelId);
  }, []);

  useEffect(() => {
    if (project) autosaveProject(project);
  }, [project]);

  useEffect(() => {
    const onStudioMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const data = event.data as
        | { type?: string; requestId?: string; package?: unknown }
        | undefined;
      if (!data?.type) return;
      if (data.type === 'skyforge-studio-request-level-package' && project) {
        const pkg = createLevelPackFromEditorProject(project);
        (event.source as WindowProxy | null)?.postMessage(
          {
            type: 'skyforge-studio-level-package',
            requestId: data.requestId,
            package: pkg,
          },
          event.origin,
        );
      }
      if (data.type === 'skyforge-studio-load-level-package') {
        const parsed = LevelStudioPackageSchema.safeParse(data.package);
        if (!parsed.success) return;
        const next = editorProjectFromLevelPack(parsed.data);
        history.current = new ProjectHistory(next);
        setProject(next);
        setLevelId(next.level.id);
        setSelectedId(null);
        setValidation([]);
        setImportError(null);
        setHistoryRevision((value) => value + 1);
      }
    };
    window.addEventListener('message', onStudioMessage);
    return () => window.removeEventListener('message', onStudioMessage);
  }, [project]);

  const commit = useCallback((next: EditorProject) => {
    if (!history.current) history.current = new ProjectHistory(next);
    setProject(history.current.commit(next));
    setHistoryRevision((value) => value + 1);
  }, []);

  const undo = () => {
    if (!history.current?.canUndo) return;
    setProject(history.current.undo());
    setHistoryRevision((value) => value + 1);
  };
  const redo = () => {
    if (!history.current?.canRedo) return;
    setProject(history.current.redo());
    setHistoryRevision((value) => value + 1);
  };

  const editEvent = (id: string, patch: Partial<LevelEvent>) => {
    if (!project) return;
    const next = structuredClone(project);
    const working = next.level.events.find((event) => event.editorId === id);
    if (!working) return;
    working.value = { ...working.value, ...patch } as LevelEvent;
    commit(next);
  };

  const deleteEvent = (id: string) => {
    if (!project) return;
    const next = structuredClone(project);
    next.level.events = next.level.events.filter((event) => event.editorId !== id);
    commit(next);
    setSelectedId(null);
  };

  const addEvent = (value: LevelEvent) => {
    if (!project) return;
    const next = structuredClone(project);
    const editorId = globalThis.crypto?.randomUUID?.() ?? `event-${Date.now()}`;
    next.level.events.push({ editorId, value });
    commit(next);
    setSelectedId(editorId);
  };

  const nextTime = project
    ? Math.min(
        project.level.durationTarget,
        (Math.max(0, ...project.level.events.map((event) => event.value.at)) || 0) + 5,
      )
    : 0;

  const runValidation = useCallback(() => {
    if (!project) return [];
    const errors = validateEditorProject(project);
    setValidation(errors);
    return errors;
  }, [project]);

  const exportPackage = () => {
    if (!project || runValidation().length > 0) return;
    projectDownloads(project).forEach((file, index) => {
      window.setTimeout(() => download(file.name, file.text), index * 120);
    });
  };

  const importPackage = (files: FileList) => {
    void Promise.all(
      [...files].map(async (file) => ({ name: file.name, text: await file.text() })),
    ).then((documents) => {
      const parsed = parseProjectPackage(documents);
      if (!parsed.project) {
        setValidation(parsed.errors);
        setImportError('Package import failed. Review the validation panel.');
        return;
      }
      history.current = new ProjectHistory(parsed.project);
      setProject(parsed.project);
      setLevelId(parsed.project.level.id);
      setSelectedId(null);
      setValidation([]);
      setImportError(null);
      setHistoryRevision((value) => value + 1);
    });
  };


  const preparePreview = (level: WorkingLevel) => {
    if (!project) return;
    stashForPreview(level);
    stashProjectForPreview(project);
  };

  if (contentErrors.length > 0) {
    return (
      <div style={{ padding: 24, color: '#ff6472', fontFamily: 'monospace' }}>
        <h2>Content failed validation</h2>
        <ul>
          {contentErrors.map((error, index) => (
            <li key={index}>
              {error.file}: {error.message}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  const terrainTargets = project?.objects?.objects.map((object) => object.id) ?? [];
  return (
    <div className={`editor epoch11 ${embedded ? 'embedded-editor' : ''}`}>
      <div className={`toolbar ${embedded ? 'embedded-toolbar' : ''}`}>
        {!embedded && <h1>SKYFORGE LEVEL COMPOSER</h1>}
        <select
          value={levelId}
          onChange={(event) => {
            setLevelId(event.target.value);
            loadLevel(event.target.value);
          }}
        >
          {project && !levels.some((level) => level.id === project.level.id) && (
            <option value={project.level.id}>
              {project.level.displayName} ({project.level.id}) — imported
            </option>
          )}
          {levels.map((level) => (
            <option key={level.id} value={level.id}>
              {level.displayName} ({level.id})
            </option>
          ))}
        </select>
        <button onClick={() => loadLevel(levelId)}>Reload</button>
        <button onClick={undo} disabled={!history.current?.canUndo}>
          Undo
        </button>
        <button onClick={redo} disabled={!history.current?.canRedo}>
          Redo
        </button>
        <button onClick={runValidation}>Validate</button>
        {!embedded && (
          <>
            <button className="primary" onClick={exportPackage}>Export Package</button>
            <button onClick={() => fileInput.current?.click()}>Import Package</button>
          </>
        )}
        <input
          ref={fileInput}
          type="file"
          accept="application/json"
          multiple
          hidden
          onChange={(event) =>
            event.target.files?.length && importPackage(event.target.files)
          }
        />
        <div className="spacer" />
        {!embedded && (<>
          <a target="_top" href={`${import.meta.env.BASE_URL || '/'}studio.html`}>studio</a>
          <a target="_top" href={`${import.meta.env.BASE_URL || '/'}index.html`}>← game</a>
        </>)}
      </div>

      <nav className="workspace-tabs">
        {(['spatial', 'timeline', 'preview'] as Workspace[]).map((tab) => (
          <button
            key={tab}
            className={workspace === tab ? 'active' : ''}
            onClick={() => setWorkspace(tab)}
          >
            {tab}
          </button>
        ))}
      </nav>

      {project && workspace === 'spatial' && (
        <SpatialComposer project={project} onChange={commit} />
      )}

      {project && workspace === 'timeline' && (
        <div className="timeline-workspace redesigned">
          <TimelineEditor
            level={project.level}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onMove={(id, at) => editEvent(id, { at })}
          />
          <div className="timeline-detail-grid">
          <div className="left">
            <p className="section-title">Events and intensity</p>
            <IntensityStrip level={project.level} />
            <div className="event-actions">
              <button
                onClick={() => addEvent({ at: nextTime, encounter: encounters[0] ?? '' })}
              >
                + Encounter
              </button>
              <button
                onClick={() => addEvent({ at: nextTime, type: 'recovery', duration: 5 })}
              >
                + Recovery
              </button>
              <button
                onClick={() =>
                  addEvent({
                    at: nextTime,
                    type: 'checkpoint',
                    name: `checkpoint_${Math.round(nextTime)}`,
                  })
                }
              >
                + Checkpoint
              </button>
              <button
                disabled={!terrainTargets[0]}
                onClick={() =>
                  terrainTargets[0] &&
                  addEvent({
                    at: nextTime,
                    type: 'terrainState',
                    target: terrainTargets[0],
                    state: 'open',
                  })
                }
              >
                + Terrain state
              </button>
            </div>
            <EventList
              level={project.level}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onDelete={deleteEvent}
            />
          </div>
          <div className="right">
            <p className="section-title">Inspector</p>
            <Inspector
              level={project.level}
              selectedId={selectedId}
              encounters={encounters}
              terrainTargets={terrainTargets}
              onEdit={editEvent}
            />
            <ValidationPanel errors={validation} importError={importError} />
          </div>
          </div>
        </div>
      )}

      {project && workspace === 'preview' && (
        <div className="preview-workspace">
          <PreviewPanel
            level={project.level}
            selectedId={selectedId}
            onPrepare={preparePreview}
          />
        </div>
      )}

      <div className="statusbar" key={historyRevision}>
        <span>{project ? `${project.level.events.length} events` : 'no level'}</span>
        <span>
          {project?.map
            ? `${project.map.layers.length} layers · ${project.map.rows} rows · 17 columns`
            : 'timeline-only level'}
        </span>
        <span>{project?.packageDef ? `package ${project.packageDef.id}` : ''}</span>
        <span>autosaved</span>
      </div>
    </div>
  );
}

function download(name: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}
