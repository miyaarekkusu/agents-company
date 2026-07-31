const cache = new Map<string, string>();

/**
 * Loads an image, removes its white background via a border-connected BFS flood fill,
 * and returns a promise resolving to a transparent PNG Data URL.
 */
export function getTransparentImage(srcUrl: string): Promise<string> {
  if (cache.has(srcUrl)) {
    return Promise.resolve(cache.get(srcUrl)!);
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(srcUrl);
          return;
        }

        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);

        const imgData = ctx.getImageData(0, 0, img.width, img.height);
        const data = imgData.data;
        const width = img.width;
        const height = img.height;

        // BFS queue: store coordinates as flat array [x0, y0, x1, y1, ...]
        const queue: number[] = [];
        const visited = new Uint8Array(width * height);

        // A pixel is considered "near white" background if all RGB components are > 200.
        // This threshold accommodates typical JPEG compression artifacts on a white background.
        const isNearWhite = (dataIdx: number) => {
          const r = data[dataIdx];
          const g = data[dataIdx + 1];
          const b = data[dataIdx + 2];
          return r > 200 && g > 200 && b > 200;
        };

        const enqueue = (x: number, y: number) => {
          const index = y * width + x;
          if (visited[index] === 0) {
            visited[index] = 1;
            const dataIdx = index * 4;
            if (isNearWhite(dataIdx)) {
              queue.push(x, y);
            }
          }
        };

        // Enqueue all border pixels to start flood fill from the outer boundary
        for (let x = 0; x < width; x++) {
          enqueue(x, 0);
          enqueue(x, height - 1);
        }
        for (let y = 1; y < height - 1; y++) {
          enqueue(0, y);
          enqueue(width - 1, y);
        }

        // Run Breadth-First Search to find and make transparent all connected white background pixels
        let head = 0;
        while (head < queue.length) {
          const x = queue[head++];
          const y = queue[head++];

          const index = y * width + x;
          const dataIdx = index * 4;

          // Set alpha component of the pixel to 0 (transparent)
          data[dataIdx + 3] = 0;

          // Explore 4-connected neighbors
          if (x > 0) enqueue(x - 1, y);
          if (x < width - 1) enqueue(x + 1, y);
          if (y > 0) enqueue(x, y - 1);
          if (y < height - 1) enqueue(x, y + 1);
        }

        ctx.putImageData(imgData, 0, 0);
        const dataUrl = canvas.toDataURL("image/png");
        cache.set(srcUrl, dataUrl);
        resolve(dataUrl);
      } catch (err) {
        console.error("Failed to process image transparency:", err);
        resolve(srcUrl); // Fallback to original image URL on error
      }
    };
    img.onerror = () => {
      resolve(srcUrl); // Fallback to original image URL if loading fails
    };
    img.src = srcUrl;
  });
}
