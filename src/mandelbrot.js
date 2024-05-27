// Initialize the canvas and its context
const canvas2= document.createElement('canvas');
const ctx = canvas2.getContext('2d');
const WIDTH = 2048;
const HEIGHT = 2048;
canvas2.width = WIDTH;
canvas2.height = HEIGHT;
// document.body.appendChild(canvas); // Add canvas to the document

// Constants and setup for Mandelbrot calculation
const MAX_ITER = 500;
const REAL_SET = { start: -2, end: 1 };
const IMAGINARY_SET = { start: -1, end: 1 };

// Function to calculate Mandelbrot
function mandelbrot(x, y) {
    let zx = 0;
    let zy = 0;
    let iter = 0;
    while (zx * zx + zy * zy < 4 && iter < MAX_ITER) {
        let temp = zx * zx - zy * zy + x;
        zy = 2.0 * zx * zy + y;
        zx = temp;
        iter++;
    }
    return iter;
}
function smoothColor(m, MAX_ITER) {
    const hue = (360 * m / MAX_ITER) % 360;
    const saturation = 100;
    const lightness = m < MAX_ITER ? 50 : 0;
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}
// Rendering the Mandelbrot set
function renderMandelbrot() {
    for (let pixelY = 0; pixelY < HEIGHT; pixelY++) {
        let y = IMAGINARY_SET.start + (pixelY / HEIGHT) * (IMAGINARY_SET.end - IMAGINARY_SET.start);
        for (let pixelX = 0; pixelX < WIDTH; pixelX++) {
            let x = REAL_SET.start + (pixelX / WIDTH) * (REAL_SET.end - REAL_SET.start);
            let m = mandelbrot(x, y, MAX_ITER);
            let color = smoothColor(m, MAX_ITER);
            ctx.fillStyle = color;
            ctx.fillRect(pixelX, pixelY, 1, 1);
        }
    }
    return imageData = canvas2.toDataURL('image/jpg');
}

