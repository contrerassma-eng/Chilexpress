// OCR en el dispositivo con Tesseract.js (sin IA, sin servidor, sin API key).
// Lee el texto de la foto de la boleta para que el parser lo mapee.
//
// Se importa de forma diferida (dynamic import) para no cargar el motor de OCR
// hasta que el usuario realmente escanee una boleta.

let workerPromise = null;

async function getWorker(onProgress) {
  if (!workerPromise) {
    workerPromise = (async () => {
      const { createWorker } = await import('tesseract.js');
      // Espanol: los nombres de producto y los rotulos estan en castellano.
      const worker = await createWorker('spa', undefined, {
        logger: (m) => {
          if (onProgress && m.status === 'recognizing text') onProgress(m.progress);
        }
      });
      return worker;
    })();
  }
  return workerPromise;
}

// Recibe un File/Blob o dataURL y devuelve el texto reconocido.
export async function ocrImage(image, onProgress) {
  const worker = await getWorker(onProgress);
  const { data } = await worker.recognize(image);
  return data.text || '';
}

// Libera el worker (opcional, p. ej. al cerrar la app).
export async function terminateOcr() {
  if (workerPromise) {
    const worker = await workerPromise;
    await worker.terminate();
    workerPromise = null;
  }
}
