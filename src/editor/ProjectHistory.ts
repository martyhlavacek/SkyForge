export class ProjectHistory<T> {
  private past: T[] = [];
  private future: T[] = [];

  constructor(
    private present: T,
    private readonly limit = 60,
  ) {}

  get value(): T {
    return structuredClone(this.present);
  }
  get canUndo(): boolean {
    return this.past.length > 0;
  }
  get canRedo(): boolean {
    return this.future.length > 0;
  }

  commit(next: T): T {
    this.past.push(structuredClone(this.present));
    if (this.past.length > this.limit) this.past.shift();
    this.present = structuredClone(next);
    this.future = [];
    return this.value;
  }

  undo(): T {
    const previous = this.past.pop();
    if (!previous) return this.value;
    this.future.push(structuredClone(this.present));
    this.present = previous;
    return this.value;
  }

  redo(): T {
    const next = this.future.pop();
    if (!next) return this.value;
    this.past.push(structuredClone(this.present));
    this.present = next;
    return this.value;
  }
}
