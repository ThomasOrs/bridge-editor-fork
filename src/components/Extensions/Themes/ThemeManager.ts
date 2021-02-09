import { EventDispatcher } from '@/components/Common/Event/EventDispatcher'
import { Signal } from '@/components/Common/Event/Signal'
import { App } from '@/App'
import { settingsState } from '@/components/Windows/Settings/SettingsState'
import { iterateDir } from '@/utils/iterateDir'
import { IDisposable } from '@/types/disposable'
import json5 from 'json5'
import { deepmerge } from '@/utils/deepmerge'
import { bridgeDark, bridgeLight } from './Default'
import { Theme } from './Theme'

const colorNames = [
	'text',
	'toolbar',
	'expandedSidebar',
	'sidebarNavigation',
	'primary',
	'secondary',
	'accent',
	'error',
	'info',
	'warning',
	'success',
	'background',
	'menu',
	'footer',
	'tooltip',
	'sidebarSelection',
	'tabActive',
	'tabInactive',
] as const
export type TColorName = typeof colorNames[number]

export class ThemeManager extends EventDispatcher<'light' | 'dark'> {
	protected mode: 'light' | 'dark'
	protected themeMap = new Map<string, Theme>()
	protected themeColorTag = document.querySelector("meta[name='theme-color']")
	protected currentTheme = 'bridge.default.dark'
	public readonly colorScheme = new Signal<'light' | 'dark'>()

	constructor(protected vuetify: any) {
		super()

		// Listen for dark/light mode changes
		const media = window.matchMedia('(prefers-color-scheme: light)')
		this.mode = media.matches ? 'light' : 'dark'
		media.addEventListener('change', mediaQuery => {
			this.colorScheme.dispatch(mediaQuery.matches ? 'light' : 'dark')
			this.mode = mediaQuery.matches ? 'light' : 'dark'
			this.updateTheme()
		})

		/**
		 * Setup theme meta tag
		 * @see ThemeManager.setThemeColor
		 */
		if (!this.themeColorTag) {
			this.themeColorTag = document.createElement('meta')
			document.head.appendChild(this.themeColorTag)
		}
		this.themeColorTag.setAttribute('name', 'theme-color')
		this.themeColorTag.id = 'theme-color-tag'

		this.addTheme(bridgeDark, true)
		this.addTheme(bridgeLight, true)
		this.applyTheme(this.themeMap.get('bridge.default.dark'))
	}

	protected applyTheme(theme?: Theme) {
		theme?.apply(this, this.vuetify)
	}
	async updateTheme() {
		const app = await App.getApp()
		let colorScheme = settingsState?.appearance?.colorScheme
		if (!colorScheme || colorScheme === 'auto') colorScheme = this.mode

		const localThemeId =
			(await app.projectConfig.get(
				<'lightTheme' | 'darkTheme'>`${colorScheme}Theme`
			)) ?? 'bridge.noSelection'
		const themeId =
			<string>settingsState?.appearance?.[`${colorScheme}Theme`] ??
			`bridge.default.${colorScheme}`

		const themeToSelect =
			localThemeId !== 'bridge.noSelection' ? localThemeId : themeId
		const theme = this.themeMap.get(
			localThemeId !== 'bridge.noSelection' ? localThemeId : themeId
		)

		const baseTheme = this.themeMap.get(`bridge.default.${colorScheme}`)

		if (
			this.currentTheme !==
			(theme ? themeToSelect : `bridge.default.${colorScheme}`)
		) {
			this.currentTheme = theme
				? themeToSelect
				: `bridge.default.${colorScheme}`
			this.applyTheme(theme ?? baseTheme)
			this.dispatch(theme?.colorScheme ?? 'dark')
		}
	}
	async loadDefaultThemes(app: App) {
		try {
			await iterateDir(
				await app.fileSystem.getDirectoryHandle('data/packages/themes'),
				fileHandle => this.loadTheme(fileHandle)
			)
		} catch {}

		this.updateTheme()
	}
	async loadTheme(
		fileHandle: FileSystemFileHandle,
		isGlobal = true,
		disposables?: IDisposable[]
	) {
		const file = await fileHandle.getFile()
		const themeDefinition = json5.parse(await file.text())

		const disposable = this.addTheme(themeDefinition, isGlobal)
		if (disposables) disposables.push(disposable)
	}

	getThemes(colorScheme?: 'dark' | 'light', global?: boolean) {
		const themes: Theme[] = []

		for (const [_, theme] of this.themeMap) {
			if (
				(!colorScheme || theme.colorScheme === colorScheme) &&
				(theme.isGlobal || global === theme.isGlobal)
			)
				themes.push(theme)
		}

		return themes
	}

	/**
	 * Updates the top browser toolbar to match the main app's toolbar color
	 * @param color Color to set the toolbar to
	 */
	setThemeColor(color: string) {
		this.themeColorTag!.setAttribute('content', color)
	}

	addTheme(themeConfig: IThemeDefinition, isGlobal: boolean) {
		const baseTheme = this.themeMap.get(
			`bridge.default.${themeConfig.colorScheme ?? 'dark'}`
		)

		this.themeMap.set(
			themeConfig.id,
			new Theme(
				deepmerge(baseTheme?.getThemeDefinition() ?? {}, themeConfig),
				isGlobal
			)
		)
		this.updateTheme()

		return {
			dispose: () => this.themeMap.delete(themeConfig.id),
		}
	}
}

export interface IThemeDefinition {
	id: string
	name: string
	colorScheme?: 'dark' | 'light'
	colors: Record<TColorName, string>
	highlighter?: Record<
		string,
		{ color?: string; textDecoration?: string; isItalic?: boolean }
	>
	monaco?: Record<string, string>
}
