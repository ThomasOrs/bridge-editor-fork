import { App } from '/@/App'
import { IPackType, TPackTypeId } from '/@/components/Data/PackType'
import { loadManifest } from './loadManifest'
import type { Project } from './Project'

export interface IPackData extends IPackType {
	version: number[]
	packPath: string
}

export async function loadPacks(app: App, project: Project) {
	await App.packType.ready.fired
	const packs: IPackData[] = []
	const config = project.config
	const definedPacks = config.getAvailablePacks()
	console.log(definedPacks)

	for (const [packId, packPath] of Object.entries(definedPacks)) {
		// Load pack manifest
		let manifest: any = {}
		try {
			manifest = await loadManifest(
				app,
				config.resolvePackPath(<TPackTypeId>packId, 'manifest.json')
			)
		} catch {}

		console.log(packId, App.packType.getFromId(<TPackTypeId>packId))

		packs.push({
			...App.packType.getFromId(<TPackTypeId>packId)!,
			packPath,
			version: manifest?.header?.version ?? [1, 0, 0],
		})
	}

	return packs
}
