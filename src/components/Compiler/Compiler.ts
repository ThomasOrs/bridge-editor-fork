import { App } from '@/App'
import { Signal } from '@/appCycle/EventSystem'
import * as Comlink from 'comlink'
import { CompilerService } from './Worker/Main'

const TaskService = Comlink.wrap<typeof CompilerService>(
	new Worker('./Worker/Main.ts', {
		type: 'module',
	})
)

export class Compiler extends Signal<void> {
	protected _service!: Comlink.Remote<CompilerService>
	public readonly ready = new Signal<boolean>()
	protected compilerPlugins = new Set<string>()

	start(projectName: string) {
		console.time('[TASK] Compiling project (total)')
		this.resetSignal()
		this.ready.dispatch(false)
		App.ready.once(async app => {
			const task = app.taskManager.create({
				icon: 'mdi-cogs',
				name: 'taskManager.tasks.compiler.title',
				description: 'taskManager.tasks.compiler.description',
			})

			// Instaniate the worker TaskService
			this._service = await new TaskService(
				await app.fileSystem.getDirectoryHandle(
					`projects/${projectName}`
				),
				app.fileSystem.baseDirectory,
				{
					config: 'dev.json',
					plugins: [...this.compilerPlugins],
				}
			)
			// Listen to task progress and update UI
			this._service.on(
				Comlink.proxy(([current, total]) => {
					if (current === total) task.complete()
					task.update(current, total)
				}),
				false
			)

			// Start service
			const errors = await this.service.start([])
			errors.forEach(e => console.error(e))
			this.dispatch()
			this.ready.dispatch(true)
			console.timeEnd('[TASK] Compiling project (total)')
		})
	}

	addCompilerPlugin(srcPath: string) {
		this.compilerPlugins.add(srcPath)

		return {
			dispose: () => this.compilerPlugins.delete(srcPath),
		}
	}

	get service() {
		return this._service
	}
}
