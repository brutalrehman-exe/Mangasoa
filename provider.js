/// <reference path="./manga-provider.d.ts" />

class Provider {
    constructor() {
        this.api = "https://api.mangadex.org"
    }

    getSettings() {
        return {
            supportsMultiLanguage: false,
            supportsMultiScanlator: false,
        }
    }

    async search(opts) {
        try {
            const url = `${this.api}/manga?title=${encodeURIComponent(opts.query)}&limit=25&includes[]=cover_art&contentRating[]=safe&contentRating[]=suggestive`
            const res = await fetch(url)
            const data = await res.json()
            const results = []

            for (const manga of (data.data || [])) {
                const titleObj = manga.attributes.title
                const title = titleObj.en || titleObj["ja-ro"] || Object.values(titleObj)[0] || ""
                const coverRel = manga.relationships.find(r => r.type === "cover_art")
                const coverFile = coverRel?.attributes?.fileName
                const coverUrl = coverFile ? `https://uploads.mangadex.org/covers/${manga.id}/${coverFile}.256.jpg` : ""
                const altTitles = manga.attributes.altTitles || []
                const synonyms = altTitles.map(t => Object.values(t)[0]).filter(Boolean)

                results.push({
                    id: manga.id,
                    title: title,
                    synonyms: synonyms,
                    image: coverUrl,
                    year: manga.attributes.year || undefined,
                })
            }
            return results
        } catch (e) {
            console.error("MangaDex search error:", e)
            return []
        }
    }

    async findChapters(mangaId) {
        try {
            let offset = 0
            const limit = 100
            const allChapters = []

            while (true) {
                const url = `${this.api}/chapter?manga=${mangaId}&limit=${limit}&offset=${offset}&translatedLanguage[]=en&order[chapter]=asc&includes[]=scanlation_group`
                const res = await fetch(url)
                const data = await res.json()
                const chapters = data.data || []
                if (chapters.length === 0) break

                for (const ch of chapters) {
                    const chNum = ch.attributes.chapter || "0"
                    const title = ch.attributes.title
                    const group = ch.relationships.find(r => r.type === "scanlation_group")

                    allChapters.push({
                        id: ch.id,
                        url: `https://mangadex.org/chapter/${ch.id}`,
                        title: title ? title : `Chapter ${chNum}`,
                        chapter: chNum,
                        index: allChapters.length,
                        language: "en",
                        scanlator: group?.attributes?.name || undefined,
                    })
                }

                if (chapters.length < limit) break
                offset += limit
            }

            // Deduplicate by chapter number
            const seen = new Set()
            const unique = allChapters.filter(ch => {
                if (seen.has(ch.chapter)) return false
                seen.add(ch.chapter)
                return true
            })

            unique.forEach((ch, i) => ch.index = i)
            return unique
        } catch (e) {
            console.error("MangaDex findChapters error:", e)
            return []
        }
    }

    async findChapterPages(chapterId) {
        try {
            const res = await fetch(`${this.api}/at-home/server/${chapterId}`)
            const data = await res.json()
            const baseUrl = data.baseUrl
            const hash = data.chapter?.hash
            const pages = data.chapter?.data || []

            return pages.map((filename, i) => ({
                url: `${baseUrl}/data/${hash}/${filename}`,
                index: i,
                headers: { "Referer": "https://mangadex.org/" }
            }))
        } catch (e) {
            console.error("MangaDex findChapterPages error:", e)
            return []
        }
    }
}
