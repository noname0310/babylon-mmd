import type { ISceneLoaderProgressEvent } from "@babylonjs/core/Loading/sceneLoader";
import type { Nullable } from "@babylonjs/core/types";

/** @internal */
export interface IProgressTask {
    readonly name: string;
    readonly cost: number;
}

interface IProgressTaskState extends IProgressTask {
    progress: number;
}

/** @internal */
export class Progress {
    public readonly lengthComputable: boolean;
    public readonly total: number;

    private readonly _onProgress: Nullable<(progress: ISceneLoaderProgressEvent) => void>;

    private readonly _unprocessedTasks: Map<string, IProgressTask>;
    private readonly _processingTasks: Map<string, IProgressTaskState>;
    private readonly _endedTaskNames: Set<string>;
    private _endedTasksTotal: number;

    public constructor(
        lengthComputable: boolean,
        tasks: IProgressTask[],
        onProgress: Nullable<(progress: ISceneLoaderProgressEvent) => void>
    ) {
        this.lengthComputable = lengthComputable;

        let total = 0;
        for (let i = 0; i < tasks.length; ++i) {
            total += tasks[i].cost;
        }
        this.total = total;

        this._onProgress = onProgress;

        const unprocessedTasks = this._unprocessedTasks = new Map<string, IProgressTask>();
        for (let i = 0; i < tasks.length; ++i) {
            if (unprocessedTasks.has(tasks[i].name)) {
                throw new Error(`Duplicated task name: ${tasks[i].name}`);
            }
            unprocessedTasks.set(tasks[i].name, tasks[i]);
        }

        this._processingTasks = new Map<string, IProgressTaskState>();
        this._endedTaskNames = new Set<string>();
        this._endedTasksTotal = 0;
    }

    private _getTaskState(taskName: string): Nullable<IProgressTaskState> {
        let taskState = this._processingTasks.get(taskName);
        if (taskState === undefined) {
            const task = this._unprocessedTasks.get(taskName);
            if (task === undefined) {
                if (!this._endedTaskNames.has(taskName)) {
                    throw new Error(`Task not found: ${taskName}`);
                } else return null;
            }

            taskState = {
                name: task.name,
                cost: task.cost,
                progress: 0
            };
            this._processingTasks.set(taskName, taskState);
            this._unprocessedTasks.delete(taskName);
        }

        return taskState;
    }

    public processTask(taskName: string, cost: number): void {
        const taskState = this._getTaskState(taskName);
        if (taskState === null) return;

        taskState.progress += cost;
        if (taskState.progress >= taskState.cost) {
            this._processingTasks.delete(taskName);
            this._endedTaskNames.add(taskName);
            this._endedTasksTotal += taskState.cost;
        }
    }

    public setTaskProgress(taskName: string, progress: number): boolean {
        const taskState = this._getTaskState(taskName);
        if (taskState === null) return false;

        taskState.progress = progress;
        if (taskState.progress >= taskState.cost) {
            this._processingTasks.delete(taskName);
            this._endedTaskNames.add(taskName);
            this._endedTasksTotal += taskState.cost;
        }

        return true;
    }

    public setTaskProgressRatio(taskName: string, ratio: number, useFloor: boolean): boolean {
        const taskState = this._getTaskState(taskName);
        if (taskState === null) return false;

        taskState.progress = useFloor
            ? Math.floor(taskState.cost * ratio)
            : taskState.cost * ratio;
        if (taskState.progress >= taskState.cost) {
            this._processingTasks.delete(taskName);
            this._endedTaskNames.add(taskName);
            this._endedTasksTotal += taskState.cost;
        }

        return true;
    }

    public endTask(taskName: string): void {
        const taskState = this._getTaskState(taskName);
        if (taskState === null) return;

        this._processingTasks.delete(taskName);
        this._endedTaskNames.add(taskName);
        this._endedTasksTotal += taskState.cost;
    }

    public invokeProgressEvent(): void {
        if (this._onProgress === null) return;

        this._onProgress({
            lengthComputable: this.lengthComputable,
            loaded: this.loaded,
            total: this.total
        });
    }

    public get loaded(): number {
        let loaded = this._endedTasksTotal;
        for (const [_taskName, task] of this._processingTasks) {
            loaded += task.progress;
        }

        return loaded;
    }
}
