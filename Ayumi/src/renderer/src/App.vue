<script setup lang="ts">
import { onMounted, ref, onUnmounted } from 'vue'

const settings = ref<{ libraryPath?: string; pythonPath?: string; scraperPath?: string }>({})
const series = ref<any[]>([])
const q = ref('')
const loading = ref(false)
const errorMsg = ref<string | null>(null)

async function refreshSettings(): Promise<void> {
  settings.value = await window.api.getSettings()
}

async function refreshLibrary(): Promise<void> {
  series.value = await window.api.scanLibrary()
}

async function pickLibrary(): Promise<void> {
  const p = await window.api.selectLibraryFolder()
  if (p) {
    await refreshSettings()
    await refreshLibrary()
  }
}

async function pickPython(): Promise<void> {
  const p = await window.api.selectPython()
  if (p) await refreshSettings()
}

async function pickScraper(): Promise<void> {
  const p = await window.api.selectScraper()
  if (p) await refreshSettings()
}

async function addBySearch(): Promise<void> {
  errorMsg.value = null
  loading.value = true
  try {
    series.value = await window.api.searchAndRescan(q.value.trim())
    q.value = ''
  } catch (e: any) {
    errorMsg.value = e?.message ?? String(e)
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  await refreshSettings()
  if (settings.value.libraryPath) await refreshLibrary()
})

const showAdd = ref(false)

function openAdd(): void {
  showAdd.value = true
  errorMsg.value = null
  q.value = ''
}

async function confirmAdd(): Promise<void> {
  await addBySearch()
  if (!errorMsg.value) showAdd.value = false
}

const scraperLog = ref('')
const scraperState = ref<'idle' | 'running' | 'done' | 'error'>('idle')

let off: null | (() => void) = null

onMounted(() => {
  off = window.api.onScraperProgress((p: any) => {
    if (p.type === 'start') {
      scraperState.value = 'running'
      scraperLog.value = `Recherche: ${p.query}\n`
    } else if (p.type === 'stdout' || p.type === 'stderr') {
      scraperLog.value += p.text
    } else if (p.type === 'done') {
      scraperState.value = p.ok ? 'done' : 'error'
    } else if (p.type === 'error') {
      scraperState.value = 'error'
      scraperLog.value += `\n[ERROR] ${p.message}\n`
    }
  })
})

onUnmounted(() => off?.())
</script>

<template>
  <div style="padding:16px; font-family: system-ui;">
    <div style="display:flex; justify-content:space-between; align-items:center;">
    <h2>Ayumi</h2>

      <button
        v-if="settings.libraryPath && settings.pythonPath && settings.scraperPath"
        @click="openAdd"
      >
        ➕ Ajouter
      </button>
    </div>

  <!-- MODAL -->
  <div v-if="showAdd"
      style="position:fixed; inset:0; background:rgba(0,0,0,.5); display:flex; align-items:center; justify-content:center;">
    <div style="background:#111; padding:16px; border-radius:12px; width:520px; max-width:90vw;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
        <b>Ajouter un manga</b>
        <button @click="showAdd=false">✕</button>
      </div>

      <div style="display:flex; gap:8px;">
        <input
          v-model="q"
          placeholder="ex: dr stone"
          style="flex:1"
          @keydown.enter="confirmAdd"
        />
        <button :disabled="loading || !q.trim()" @click="confirmAdd">
          {{ loading ? 'Ajout...' : 'Ajouter' }}
        </button>
      </div>

      <p v-if="errorMsg" style="color:#ff6b6b; white-space:pre-wrap; margin-top:12px">
        {{ errorMsg }}
      </p>

      <div v-if="scraperState === 'running'" style="margin-top:12px;">
        <div style="display:flex; align-items:center; gap:8px; opacity:.9;">
          <span>⏳ Scraping en cours…</span>
        </div>

        <pre style="margin-top:10px; max-height:220px; overflow:auto; background:#0b0b0b; padding:10px; border-radius:10px; font-size:12px; line-height:1.3;">
        {{ scraperLog }}
        </pre>
      </div>

      <p style="opacity:.7; margin-top:10px; font-size:12px;">
        Astuce: appuie sur Entrée pour lancer.
      </p>
    </div>
  </div>


    <!-- 1) Pas de bibliothèque -->
    <div v-if="!settings.libraryPath">
      <p>Aucune bibliothèque configurée.</p>
      <button @click="pickLibrary">Choisir le dossier bibliothèque</button>
    </div>

    <!-- 2) Bibliothèque OK mais config Python/Scraper manquante -->
    <div v-else-if="!settings.pythonPath || !settings.scraperPath">
      <p><b>Bibliothèque :</b> {{ settings.libraryPath }}</p>
      <h3>Configuration requise</h3>
      <p>Pour ajouter/mettre à jour des mangas, indique le Python de ton venv et le script du scraper.</p>

      <div style="display:flex; gap:8px; flex-wrap:wrap;">
        <button @click="pickPython">
          {{ settings.pythonPath ? 'Python configuré ✅' : 'Choisir Python (venv)' }}
        </button>
        <button @click="pickScraper">
          {{ settings.scraperPath ? 'Scraper configuré ✅' : 'Choisir le scraper (.py)' }}
        </button>
      </div>

      <p style="margin-top:12px; opacity:.8">
        Astuce : sélectionne <code>venv\\Scripts\\python.exe</code>
      </p>
    </div>

    <!-- 3) Tout OK : scan vide -> proposer recherche -->
    <div v-else-if="series.length === 0">
      <h3>Aucun manga dans ta bibliothèque</h3>
      <p>Ajoute ton premier manga via une recherche Nautiljon.</p>

      <div style="display:flex; gap:8px; max-width:520px;">
        <input v-model="q" placeholder="ex: moi quand je me reincarne" style="flex:1" />
        <button :disabled="loading || !q.trim()" @click="addBySearch">
          {{ loading ? 'Ajout...' : 'Ajouter' }}
        </button>
      </div>

      <p v-if="errorMsg" style="color:#c00; white-space:pre-wrap; margin-top:12px">
        {{ errorMsg }}
      </p>
    </div>

    <!-- 4) Sinon : afficher la liste -->
    <div v-else>
      <p><b>Bibliothèque :</b> {{ settings.libraryPath }}</p>
      <button @click="refreshLibrary">Scanner</button>

      <hr style="margin:16px 0;" />

      <div v-for="s in series" :key="s.folderPath" style="margin-bottom:12px;">
        <div><b>{{ s.title }}</b> — manquants: {{ s.missingCount }} — prog: {{ s.progressLabel }}</div>
        <div v-if="s.soonOut">prochain: {{ s.soonOut.title }} ({{ s.soonOut.dateISO ?? s.soonOut.dateRaw }})</div>
      </div>
    </div>
  </div>

</template>
