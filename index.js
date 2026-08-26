export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Devuelve la planilla Excel desde Dropbox.
    if (url.pathname === "/api/datos") {
      return obtenerExcel(request, env);
    }

    // Muestra el index.html y los demás archivos estáticos.
    return env.ASSETS.fetch(request);
  },
};

async function obtenerExcel(request, env) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return respuestaJSON(
      {
        error: true,
        mensaje: "Método no permitido.",
      },
      405,
      {
        Allow: "GET, HEAD",
      }
    );
  }

  if (!env.EXCEL_URL) {
    return respuestaJSON(
      {
        error: true,
        mensaje: "Falta configurar el Secret EXCEL_URL en Cloudflare.",
      },
      500
    );
  }

  try {
    const urlDropbox = new URL(env.EXCEL_URL);

    // Evita que Dropbox entregue una versión anterior.
    urlDropbox.searchParams.set("t", Date.now().toString());

    const respuesta = await fetch(urlDropbox.toString(), {
      method: request.method,
      headers: {
        Accept:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/octet-stream,*/*",
        "User-Agent": "Cloudflare-Worker-Salida-Las-Canas/1.0",
      },
      redirect: "follow",
      cf: {
        cacheTtl: 0,
        cacheEverything: false,
      },
    });

    if (!respuesta.ok) {
      return respuestaJSON(
        {
          error: true,
          mensaje: "No se pudo descargar la planilla de Dropbox.",
          detalle: `HTTP ${respuesta.status}`,
        },
        502
      );
    }

    const headers = new Headers();

    headers.set(
      "Content-Type",
      respuesta.headers.get("Content-Type") ||
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );

    headers.set(
      "Content-Disposition",
      'inline; filename="SALIDA-LAS-CANAS.xlsx"'
    );

    headers.set(
      "Cache-Control",
      "no-store, no-cache, must-revalidate"
    );

    headers.set("Pragma", "no-cache");
    headers.set("X-Content-Type-Options", "nosniff");

    const contentLength = respuesta.headers.get("Content-Length");

    if (contentLength) {
      headers.set("Content-Length", contentLength);
    }

    return new Response(
      request.method === "HEAD" ? null : respuesta.body,
      {
        status: 200,
        headers,
      }
    );
  } catch (error) {
    return respuestaJSON(
      {
        error: true,
        mensaje: "Error interno al consultar la planilla.",
        detalle:
          error instanceof Error
            ? error.message
            : String(error),
      },
      500
    );
  }
}

function respuestaJSON(contenido, estado = 200, headersExtra = {}) {
  return new Response(JSON.stringify(contenido), {
    status: estado,
    headers: {
      "Content-Type": "application/json; charset=UTF-8",
      "Cache-Control": "no-store",
      ...headersExtra,
    },
  });
}
