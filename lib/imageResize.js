// Resize an image File to a JPEG blob to keep uploads small.
// Shared by the Train workout photos and the per-workout photo attach.
export function resizeToBlob(file, maxWidth = 1400) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.onload = (e) => {
      const img = new Image()
      img.onerror = () => reject(new Error('Failed to load image'))
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas')
          let { width, height } = img
          if (width > height) {
            if (width > maxWidth) { height *= maxWidth / width; width = maxWidth }
          } else {
            if (height > maxWidth) { width *= maxWidth / height; height = maxWidth }
          }
          canvas.width = width
          canvas.height = height
          const ctx = canvas.getContext('2d')
          if (!ctx) return reject(new Error('Canvas not supported'))
          ctx.drawImage(img, 0, 0, width, height)
          canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Failed to process image'))), 'image/jpeg', 0.85)
        } catch (err) {
          reject(err)
        }
      }
      img.src = e.target.result
    }
    reader.readAsDataURL(file)
  })
}
