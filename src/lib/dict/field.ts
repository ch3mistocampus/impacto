export const field = {
  // home / gate
  "field.title": { es: "Reportes de campo", en: "Field reports" },
  "field.subtitle": {
    es: "Describe el daño con tu voz o por escrito. La IA prepara un borrador y tú lo revisas.",
    en: "Describe the damage by voice or text. AI prepares a draft and you review it.",
  },
  "field.gate.title": { es: "Solo para trabajadores de campo", en: "Field workers only" },
  "field.gate.body": {
    es: "Entra con la cuenta demo de trabajador de campo para crear reportes.",
    en: "Sign in with the demo field worker account to create reports.",
  },
  "field.gate.button": { es: "Entrar como trabajador de campo", en: "Sign in as field worker" },
  "field.new": { es: "Nuevo proyecto", en: "New project" },
  "field.myProjects": { es: "Mis proyectos", en: "My projects" },
  "field.empty": { es: "Todavía no tienes proyectos.", en: "You have no projects yet." },
  "field.untitled": { es: "Sin título (borrador)", en: "Untitled (draft)" },
  "field.needsCount": { es: "materiales", en: "materials" },
  "field.toConfirm": { es: "por confirmar", en: "to confirm" },
  "field.status.draft": { es: "Borrador", en: "Draft" },
  "field.status.in_review": { es: "Pendiente de revisión", en: "Pending review" },
  "field.status.published": { es: "Activo", en: "Active" },
  "field.status.paused": { es: "Pausado por seguridad", en: "Paused for safety" },
  "field.status.completed": { es: "Completado", en: "Completed" },
  "field.status.rejected": { es: "Archivado", en: "Archived" },
  "field.notFound": { es: "Proyecto no encontrado.", en: "Project not found." },

  // step 1 capture
  "field.step1": { es: "1. Describe la situación", en: "1. Describe the situation" },
  "field.language": { es: "Idioma del reporte", en: "Report language" },
  "field.mode.voice": { es: "Grabar voz", en: "Record voice" },
  "field.mode.text": { es: "Escribir", en: "Type" },
  "field.rec.start": { es: "Grabar", en: "Record" },
  "field.rec.stop": { es: "Detener", en: "Stop" },
  "field.rec.again": { es: "Grabar de nuevo", en: "Re-record" },
  "field.rec.recording": { es: "Grabando…", en: "Recording…" },
  "field.rec.ready": { es: "Grabación lista", en: "Recording ready" },
  "field.rec.hint": {
    es: "Describe el daño y los materiales que se necesitan. No digas nombres ni direcciones.",
    en: "Describe the damage and needed materials. Don't say names or addresses.",
  },
  "field.rec.denied": {
    es: "No se pudo usar el micrófono. Escribe el reporte o usa la transcripción de demo.",
    en: "Microphone unavailable. Type the report or use the demo transcript.",
  },
  "field.mic.denied": {
    es: "No tenemos permiso para usar el micrófono. No pasa nada: escribe el reporte aquí abajo (o usa la transcripción de demo).",
    en: "We don't have permission to use the microphone. No problem: type the report below (or use the demo transcript).",
  },
  "field.mic.unsupported": {
    es: "Este navegador no puede grabar audio. Escribe el reporte aquí abajo (o usa la transcripción de demo).",
    en: "This browser can't record audio. Type the report below (or use the demo transcript).",
  },
  "field.text.placeholder": {
    es: "Ej.: Necesitamos aproximadamente 200 ladrillos, 15 bolsas de cemento…",
    en: "E.g.: We need about 200 bricks, 15 bags of cement…",
  },
  "field.demoTranscript": { es: "Usar transcripción de demo", en: "Use demo transcript" },
  "field.photos": { es: "Fotos del daño y materiales", en: "Photos of damage and materials" },
  "field.photos.add": { es: "Tomar o añadir fotos", en: "Take or add photos" },
  "field.photos.private": {
    es: "Las fotos quedan privadas. Solo se envían a la IA si tú lo pides, foto por foto; la organización aprueba cuáles son seguras para publicar.",
    en: "Photos stay private. They're only sent to AI if you ask, one photo at a time; the nonprofit approves which are safe to publish.",
  },
  "field.photos.remove": { es: "Quitar foto", en: "Remove photo" },
  "field.photos.processing": { es: "Preparando…", en: "Preparing…" },
  "field.photos.metaStripped": {
    es: "Metadatos de ubicación eliminados (EXIF/GPS) y foto comprimida antes de subir.",
    en: "Location metadata removed (EXIF/GPS) and photo compressed before upload.",
  },
  "field.photos.failed": {
    es: "Una o más fotos no se pudieron procesar y no se subieron. Prueba con otra foto (JPG o PNG).",
    en: "One or more photos couldn't be processed and weren't uploaded. Try another photo (JPG or PNG).",
  },
  "field.analyze": { es: "Analizar con IA", en: "Analyze with AI" },
  "field.needInput": { es: "Graba audio o escribe una descripción.", en: "Record audio or type a description." },

  // step 2 analyzing
  "field.analyzing": { es: "Analizando…", en: "Analyzing…" },
  "field.analyzing.body": {
    es: "Preparando un borrador. Solo se envía el texto, con nombres y teléfonos ocultos (sin datos privados ni fotos).",
    en: "Drafting. Only the text is sent, with names and phone numbers hidden (no private data, no photos).",
  },
  "field.analyzing.bodyAudio": {
    es: "Transcribiendo tu audio con un servicio de IA y preparando un borrador. Antes de extraer los datos se ocultan nombres y teléfonos. No se envían datos privados ni fotos.",
    en: "Transcribing your audio with an AI service and drafting. Names and phone numbers are hidden before extraction. No private data or photos are sent.",
  },
  "field.analyzing.slow": {
    es: "Puede tardar hasta 45 segundos. Si falla, podrás escribir el reporte.",
    en: "This can take up to 45 seconds. If it fails, you can type the report.",
  },

  // audio → AI consent (per report)
  "field.audioAi.toggle": { es: "Enviar audio a IA para transcribir", en: "Send audio to AI for transcription" },
  "field.audioAi.notice": {
    es: "La grabación se envía a un servicio de IA externo (OpenRouter) solo para transcribirla. No digas nombres, direcciones ni teléfonos.",
    en: "The recording is sent to an external AI service (OpenRouter) only to transcribe it. Don't say names, addresses or phone numbers.",
  },
  "field.audioAi.off": {
    es: "Audio a IA desactivado. Escribe el reporte aquí; el audio no se graba ni se sube.",
    en: "Audio to AI is off. Type the report here; no audio is recorded or uploaded.",
  },
  "field.audioAi.offVoice": {
    es: "Para grabar, activa “Enviar audio a IA para transcribir”, o escribe el reporte en la pestaña Escribir.",
    en: "To record, turn on “Send audio to AI for transcription”, or type the report in the Type tab.",
  },
  "field.needsText.title": { es: "Necesitamos el texto del reporte", en: "We need the report text" },
  "field.needsText.no_api_key_audio": {
    es: "La transcripción automática no está disponible ahora. Escribe o pega lo que dijiste, o usa la transcripción de demo.",
    en: "Automatic transcription isn't available right now. Type or paste what you said, or use the demo transcript.",
  },
  "field.needsText.transcription_failed": {
    es: "No se pudo transcribir el audio. Escribe o pega lo que dijiste, o usa la transcripción de demo.",
    en: "The audio couldn't be transcribed. Type or paste what you said, or use the demo transcript.",
  },
  "field.needsText.transcription_timeout": {
    es: "La transcripción tardó demasiado (más de 45 s). Escribe o pega lo que dijiste, o usa la transcripción de demo.",
    en: "Transcription took too long (over 45 s). Type or paste what you said, or use the demo transcript.",
  },
  "field.needsText.no_input": {
    es: "No hay audio ni texto. Escribe una descripción.",
    en: "No audio or text yet. Type a description.",
  },
  "field.hasAudio": { es: "Audio guardado con el reporte.", en: "Audio saved with the report." },

  // step 3 review
  "field.step3": { es: "Revisa el borrador", en: "Review the draft" },
  "field.review.intro": {
    es: "La IA puede equivocarse. Revisa y corrige cada campo. Las cantidades desconocidas quedan en blanco.",
    en: "AI can be wrong. Review and correct every field. Unknown quantities stay blank.",
  },
  "field.transcript": { es: "Transcripción original", en: "Original transcript" },
  "field.showTranslation": { es: "Ver traducción", en: "Show translation" },
  "field.hideTranslation": { es: "Ocultar traducción", en: "Hide translation" },
  "field.noTranslation": { es: "Traducción no disponible.", en: "Translation not available." },
  "field.source.ai": { es: "Borrador generado por IA", en: "Draft generated by AI" },
  "field.source.fallback": { es: "Extracción local (sin IA)", en: "Local extraction (no AI)" },
  "field.source.fallback.ai_timeout": {
    es: "El servicio de IA tardó demasiado; se usó el extractor local. Revisa todo con cuidado.",
    en: "The AI service took too long; the local extractor was used. Review everything carefully.",
  },
  "field.source.fallback.ai_error": {
    es: "El servicio de IA no respondió; se usó el extractor local. Revisa todo con cuidado.",
    en: "The AI service didn't respond; the local extractor was used. Review everything carefully.",
  },
  "field.source.fallback.openai_error": {
    es: "El servicio de IA no respondió; se usó el extractor local. Revisa todo con cuidado.",
    en: "The AI service didn't respond; the local extractor was used. Review everything carefully.",
  },
  "field.source.fallback.no_api_key": {
    es: "IA no configurada; se usó el extractor local. Revisa todo con cuidado.",
    en: "AI not configured; the local extractor was used. Review everything carefully.",
  },
  "field.redacted": {
    es: "datos personales (nombres/teléfonos) se ocultaron antes de enviar a la IA.",
    en: "personal details (names/phones) were hidden before sending to AI.",
  },
  "field.reanalyze": { es: "Volver a analizar", en: "Re-analyze" },
  "field.reanalyze.confirm": {
    es: "Esto reemplaza tus cambios con un nuevo borrador de IA. ¿Continuar?",
    en: "This replaces your edits with a new AI draft. Continue?",
  },
  "field.editTranscript": { es: "Editar transcripción", en: "Edit transcript" },
  "field.titleEs": { es: "Título (español)", en: "Title (Spanish)" },
  "field.titleEn": { es: "Título (inglés)", en: "Title (English)" },
  "field.summaryEs": { es: "Situación (español)", en: "Situation (Spanish)" },
  "field.summaryEn": { es: "Situación (inglés)", en: "Situation (English)" },
  "field.category": { es: "Categoría", en: "Category" },
  "field.urgency": { es: "Urgencia", en: "Urgency" },
  "field.urgency.suggested": { es: "Sugerencia de la IA — confírmala", en: "AI suggestion — please confirm" },
  "field.damage": { es: "Descripción del daño", en: "Damage description" },
  "field.damageEs": { es: "Daño (español)", en: "Damage (Spanish)" },
  "field.damageEn": { es: "Daño (inglés)", en: "Damage (English)" },
  "field.milestones": { es: "Hitos propuestos", en: "Proposed milestones" },
  "field.milestones.hint": {
    es: "Pasos verificables del proyecto. La organización los revisa antes de publicarlos.",
    en: "Verifiable project steps. The nonprofit reviews them before publishing.",
  },
  "field.milestones.add": { es: "Añadir hito", en: "Add milestone" },
  "field.milestones.remove": { es: "Quitar hito", en: "Remove milestone" },
  "field.mat.approx": { es: "Aproximado", en: "Approximate" },
  "field.fields": { es: "Campos extraídos", en: "Extracted fields" },
  "field.urgency.low": { es: "Baja", en: "Low" },
  "field.urgency.medium": { es: "Media", en: "Medium" },
  "field.urgency.high": { es: "Alta", en: "High" },
  "field.materials": { es: "Materiales necesarios", en: "Materials needed" },
  "field.mat.nameEs": { es: "Nombre (es)", en: "Name (es)" },
  "field.mat.nameEn": { es: "Nombre (en)", en: "Name (en)" },
  "field.mat.qty": { es: "Cantidad", en: "Quantity" },
  "field.mat.unit": { es: "Unidad", en: "Unit" },
  "field.mat.type": { es: "Tipo", en: "Type" },
  "field.mat.add": { es: "Añadir material", en: "Add material" },
  "field.mat.remove": { es: "Quitar", en: "Remove" },
  "field.mat.quote": { es: "Dicho en el audio", en: "Said in the report" },
  "field.mat.qtyBlank": { es: "Dejar en blanco si no se sabe", en: "Leave blank if unknown" },
  "field.mat.other": { es: "Otro", en: "Other" },
  "field.missing": { es: "Preguntas pendientes", en: "Open questions" },
  "field.missing.hint": {
    es: "Responde lo que sepas editando los campos de arriba.",
    en: "Answer what you can by editing the fields above.",
  },

  // opt-in photo analysis
  "field.photoAi.title": { es: "Analizar fotos con IA (opcional)", en: "Analyze photos with AI (optional)" },
  "field.photoAi.warning": {
    es: "Solo fotos sin personas, caras, números de casa ni nombres. La foto se envía a un servicio de IA externo (OpenRouter).",
    en: "Only photos without people, faces, house numbers or names. The photo is sent to an external AI service (OpenRouter).",
  },
  "field.photoAi.confirm": {
    es: "Confirmo que esta foto no muestra personas, caras, números de casa ni nombres.",
    en: "I confirm this photo shows no people, faces, house numbers or names.",
  },
  "field.photoAi.button": { es: "Analizar foto con IA", en: "Analyze photo with AI" },
  "field.photoAi.again": { es: "Analizar de nuevo", en: "Analyze again" },
  "field.photoAi.analyzing": { es: "Analizando foto…", en: "Analyzing photo…" },
  "field.photoAi.suggested": { es: "Sugerencia de IA desde la foto", en: "AI suggestion from photo" },
  "field.photoAi.observations": { es: "Daños observados", en: "Observed damage" },
  "field.photoAi.addToDamage": { es: "Añadir a la descripción del daño", en: "Add to damage description" },
  "field.photoAi.accept": { es: "Aceptar", en: "Accept" },
  "field.photoAi.discard": { es: "Descartar", en: "Discard" },
  "field.photoAi.accepted": { es: "Aceptado", en: "Accepted" },
  "field.photoAi.discarded": { es: "Descartado", en: "Discarded" },
  "field.photoAi.none": { es: "La IA no sugirió materiales para esta foto.", en: "AI suggested no materials for this photo." },
  "field.photoAi.privacyConcern": {
    es: "La IA detectó posibles personas o datos identificables en esta foto. No la publiques; considera quitarla.",
    en: "AI noticed possible people or identifying details in this photo. Don't publish it; consider removing it.",
  },
  "field.photoAi.confidence.low": { es: "confianza baja", en: "low confidence" },
  "field.photoAi.confidence.medium": { es: "confianza media", en: "medium confidence" },
  "field.photoAi.confidence.high": { es: "confianza alta", en: "high confidence" },
  "field.photoAi.error.failed": {
    es: "No se pudo analizar la foto. Inténtalo de nuevo o añade los materiales a mano.",
    en: "The photo couldn't be analyzed. Try again or add materials by hand.",
  },
  "field.photoAi.error.timeout": {
    es: "El análisis tardó demasiado (más de 45 s). Inténtalo de nuevo.",
    en: "The analysis took too long (over 45 s). Try again.",
  },
  "field.photoAi.error.no_api_key": {
    es: "El análisis de fotos con IA no está configurado.",
    en: "AI photo analysis isn't configured.",
  },
  "field.photoAi.error.not_confirmed": {
    es: "Marca la confirmación antes de analizar.",
    en: "Tick the confirmation before analyzing.",
  },
  "field.photoAi.error.photo_missing": { es: "La foto ya no existe.", en: "The photo no longer exists." },
  "field.photoAi.needsSave": {
    es: "Las fotos se analizan después de subirse.",
    en: "Photos can be analyzed after they're uploaded.",
  },

  // step 4 private
  "field.private.title": { es: "Información privada", en: "Private details" },
  "field.private.body": {
    es: "Opcional. Solo la ven tú y la coordinación de la organización. Nunca se publica y nunca se envía a la IA.",
    en: "Optional. Only you and the nonprofit's coordinators can see it. Never published and never sent to AI.",
  },
  "field.private.badge": { es: "Privado", en: "Private" },
  "field.private.name": { es: "Nombre de la persona beneficiaria", en: "Beneficiary name" },
  "field.private.contact": { es: "Contacto (teléfono / correo)", en: "Contact (phone / email)" },
  "field.private.address": { es: "Ubicación precisa", en: "Precise location" },
  "field.private.notes": { es: "Notas privadas", en: "Private notes" },

  // step 5 actions
  "field.saveDraft": { es: "Guardar borrador", en: "Save draft" },
  "field.saved": { es: "Guardado", en: "Saved" },
  "field.submit": { es: "Enviar a revisión", en: "Submit for review" },
  "field.saving": { es: "Guardando…", en: "Saving…" },
  "field.error": { es: "Algo salió mal. Inténtalo de nuevo.", en: "Something went wrong. Try again." },
  "field.missingFields": { es: "Faltan campos obligatorios:", en: "Required fields missing:" },
  "field.req.title": { es: "título", en: "title" },
  "field.req.summary": { es: "situación", en: "situation" },
  "field.req.transcript": { es: "transcripción", en: "transcript" },
  "field.req.needs": { es: "al menos un material", en: "at least one material" },
  "field.req.needName": { es: "nombre de cada material", en: "name of every material" },
  "field.success.title": { es: "¡Enviado a revisión!", en: "Submitted for review!" },
  "field.success.body": {
    es: "La organización revisará el proyecto, elegirá un nombre público anónimo y aprobará las fotos seguras antes de publicarlo.",
    en: "The nonprofit will review the project, choose an anonymous public name, and approve safe photos before publishing.",
  },
  "field.success.back": { es: "Volver a mis proyectos", en: "Back to my projects" },
  "field.readonly": {
    es: "Este proyecto ya no es un borrador y no se puede editar.",
    en: "This project is no longer a draft and can't be edited.",
  },
} satisfies Record<string, { es: string; en: string }>;
