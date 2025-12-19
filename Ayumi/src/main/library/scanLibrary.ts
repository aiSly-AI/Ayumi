import fs from 'node:fs'
import path from 'node:path'

type SeriesData = {
	link: string
	titles: { main: string; alt?: string; original?: string; japanese?: string }
	soonOut?: { title: string; date: string }
	lastOut?: { title: string; date: string }
	volumes?: Record<string, { number: number; status: 'OUT' | 'ANNOUNCED' | string }>
	collection?: { owned: number[]; wishlist: number[] }
	lastScrapedAt?: string
	version?: number
	id?: string
}

export type SeriesSummary = {
	folderPath: string
	jsonPath: string
	title: string
	soonOut?: { title: string; dateISO?: string; dateRaw: string; ts?: number }
	missingCount: number
	outCount: number
	ownedCount: number
	progressLabel: string
	lastScrapedAt?: string
}

/** Parse "YYYY-MM-DD" or "DD/MM/YYYY" into timestamp (ms). */
function parseDateToTs(input: string | undefined): number | undefined {
	if (!input) return
	// ISO
	if (/^\d{4}-\d{2}-\d{2}$/.test(input)) {
		const ts = Date.parse(input + 'T00:00:00')
		return Number.isNaN(ts) ? undefined : ts
	}
	// DD/MM/YYYY
	const m = input.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
	if (m) {
		const [, dd, mm, yyyy] = m
		const iso = `${yyyy}-${mm}-${dd}`
		const ts = Date.parse(iso + 'T00:00:00')
		return Number.isNaN(ts) ? undefined : ts
	}
	// fallback
	const ts = Date.parse(input)
	return Number.isNaN(ts) ? undefined : ts
}

function toISODate(input: string | undefined): string | undefined {
	if (!input) return
	if (/^\d{4}-\d{2}-\d{2}$/.test(input)) return input
	const m = input.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
	if (m) {
		const [, dd, mm, yyyy] = m
		return `${yyyy}-${mm}-${dd}`
	}
	return undefined
}

export function scanLibrary(libraryPath: string): SeriesSummary[] {
	if (!fs.existsSync(libraryPath)) return []

	const entries = fs.readdirSync(libraryPath, { withFileTypes: true })
	const folders = entries.filter(
		(e) => e.isDirectory()
	).map((e) => path.join(libraryPath, e.name))

	const results: SeriesSummary[] = []

	for (const folderPath of folders) {
		const jsonPath = path.join(folderPath, 'data.json')
		if (!fs.existsSync(jsonPath)) continue

		try {
			const raw = fs.readFileSync(jsonPath, 'utf-8')
			const data = JSON.parse(raw) as SeriesData

			const title = data.titles?.main ?? path.basename(folderPath)

			const owned = new Set((data.collection?.owned ?? []).map(Number))
			const volumes = data.volumes ?? {}
			const outNumbers = Object.values(volumes)
				.filter((v) => v?.status === 'OUT')
				.map((v) => Number(v.number))
				.filter((n) => Number.isFinite(n))

			const outSet = new Set(outNumbers)
			let ownedOutCount = 0
			for (const n of outSet) if (owned.has(n)) ownedOutCount++

			const missingCount = Math.max(0, outSet.size - ownedOutCount)

			const soonRaw = data.soonOut?.date
			const soonTs = parseDateToTs(soonRaw)
			const soonISO = toISODate(soonRaw)

			results.push({
				folderPath,
				jsonPath,
				title,
				soonOut: data.soonOut
					? { 
						title: data.soonOut.title,
						dateRaw: data.soonOut.date,
						dateISO: soonISO,
						ts: soonTs 
					}
					: undefined,
				missingCount,
				outCount: outSet.size,
				ownedCount: ownedOutCount,
				progressLabel: `${ownedOutCount}/${outSet.size}`,
				lastScrapedAt: data.lastScrapedAt
			})
		} catch {
			// ignore invalid series folder
		}
	}


	// tri par prochain tome (sans date -> fin)
	results.sort((a, b) => {
		const at = a.soonOut?.ts ?? Number.POSITIVE_INFINITY
		const bt = b.soonOut?.ts ?? Number.POSITIVE_INFINITY
		return at - bt
	})

	return results
}
