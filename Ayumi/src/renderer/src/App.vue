<script setup lang="ts">
import { onMounted, ref } from 'vue'

const settings = ref<{ libraryPath?: string; pythonPath?: string; scraperPath?: string }>({})
const series = ref<any[]>([])
const q = ref('')
const loading = ref(false)
const errorMsg = ref<string | null>(null)

async function refreshSettings() {
  settings.value = await window.api.getSettings()
}

async function refreshLibrary() {
  series.value = await window.api.scanLibrary()
}

async function pickLibrary() {
  const p = await window.api.selectLibraryFolder()
  if (p) {
    await refreshSettings()
    await refreshLibrary()
  }
}

async function pickPython() {
  const p = await window.api.selectPython()
  if (p) await refreshSettings()
}

async function pickScraper() {
  const p = await window.api.selectScraper()
  if (p) await refreshSettings()
}

async function addBySearch() {
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
</script>

<template>
  <div style="padding:16px; font-family: system-ui;">
    <h2>Ayumi</h2>

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
