<script setup lang="ts">
import { onMounted, ref } from 'vue'

const libraryPath = ref<string | undefined>()
const series = ref<any[]>([])

async function refresh(): Promise<void> {
  series.value = await window.api.scanLibrary()
}

async function pickFolder(): Promise<void> {
  const p = await window.api.selectLibraryFolder()
  if (p) {
    libraryPath.value = p
    await refresh()
  }
}

onMounted(async () => {
  const s = await window.api.getSettings()
  libraryPath.value = s.libraryPath
  if (libraryPath.value) await refresh()
})
</script>

<template>
  <div style="padding: 16px; font-family: system-ui;">
    <h2>Ayumi</h2>

    <div v-if="!libraryPath">
      <p>Aucune bibliothèque configurée.</p>
      <button @click="pickFolder">Choisir le dossier bibliothèque</button>
    </div>

    <div v-else>
      <p><b>Bibliothèque :</b> {{ libraryPath }}</p>
      <button @click="refresh">Scanner</button>

      <hr style="margin: 16px 0;" />

      <div v-for="s in series" :key="s.folderPath" style="margin-bottom: 12px;">
        <div><b>{{ s.title }}</b> — manquants: {{ s.missingCount }} — prog: {{ s.progressLabel }}</div>
        <div v-if="s.soonOut">prochain: {{ s.soonOut.title }} ({{ s.soonOut.dateISO ?? s.soonOut.dateRaw }})</div>
      </div>
    </div>
  </div>
</template>
