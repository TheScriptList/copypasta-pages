import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootDir = path.resolve(__dirname, '..');
const srcPath = path.join(rootDir, 'static', 'favicon.png');
const outDir = path.join(rootDir, 'static');

const MASKABLE_PADDING = 0; // Default to 0, increase to shrink the icon and add background
const MASKABLE_BACKGROUND = '#0a0c10'; // Color to fill the padding

async function generateIcons() {
	let sharp;
	try {
		const sharpModule = await import('sharp');
		sharp = sharpModule.default || sharpModule;
	} catch {
		console.error('❌ Error: sharp library is required to generate icons.');
		console.error('Please install it by running: npm install -D sharp');
		console.error(
			'Or run this script via npx: npx -y --package=sharp node scripts/generate-icons.mjs'
		);
		process.exit(1);
	}

	if (!fs.existsSync(srcPath)) {
		console.error(`❌ Error: Source image not found at ${srcPath}`);
		process.exit(1);
	}

	console.log(`🎨 Reading source icon: static/favicon.png`);
	const srcBuffer = fs.readFileSync(srcPath);

	const targets = [
		{ name: 'icon-192.png', size: 192, format: 'png' },
		{ name: 'icon-512.png', size: 512, format: 'png' },
		{ name: 'icon-192.webp', size: 192, format: 'webp' },
		{ name: 'icon-512.webp', size: 512, format: 'webp' },
		{ name: 'icon-maskable-512.png', size: 512, format: 'png', isMaskable: true },
		{ name: 'icon-maskable-512.webp', size: 512, format: 'webp', isMaskable: true }
	];

	console.log('⚡ Generating PWA raster icons...\n');

	for (const target of targets) {
		const outPath = path.join(outDir, target.name);
		let pipeline = sharp(srcBuffer);

		if (target.isMaskable && MASKABLE_PADDING > 0) {
			const innerSize = target.size - MASKABLE_PADDING * 2;
			pipeline = pipeline.resize(innerSize, innerSize).extend({
				top: MASKABLE_PADDING,
				bottom: MASKABLE_PADDING,
				left: MASKABLE_PADDING,
				right: MASKABLE_PADDING,
				background: MASKABLE_BACKGROUND
			});
		} else {
			pipeline = pipeline.resize(target.size, target.size);
		}

		if (target.format === 'webp') {
			pipeline = pipeline.webp({ quality: 90 });
		} else {
			pipeline = pipeline.png({ compressionLevel: 9, quality: 90 });
		}

		await pipeline.toFile(outPath);
		console.log(
			`  ✅ Generated: static/${target.name.padEnd(21)} (${target.size}x${target.size} ${target.format.toUpperCase()})`
		);
	}

	// Generate favicon.ico (32x32 Windows ICO container with PNG payload)
	const icoPath = path.join(outDir, 'favicon.ico');
	const icoPngBuffer = await sharp(srcBuffer)
		.resize(32, 32)
		.png({ compressionLevel: 9 })
		.toBuffer();

	const icoHeader = Buffer.alloc(22);
	icoHeader.writeUInt16LE(0, 0); // Reserved
	icoHeader.writeUInt16LE(1, 2); // Type: 1 = ICO
	icoHeader.writeUInt16LE(1, 4); // Number of images: 1
	icoHeader.writeUInt8(32, 6); // Width
	icoHeader.writeUInt8(32, 7); // Height
	icoHeader.writeUInt8(0, 8); // Color palette
	icoHeader.writeUInt8(0, 9); // Reserved
	icoHeader.writeUInt16LE(1, 10); // Color planes
	icoHeader.writeUInt16LE(32, 12); // Bits per pixel
	icoHeader.writeUInt32LE(icoPngBuffer.length, 14); // Image data size
	icoHeader.writeUInt32LE(22, 18); // Offset of image data

	fs.writeFileSync(icoPath, Buffer.concat([icoHeader, icoPngBuffer]));
	console.log(`  ✅ Generated: static/favicon.ico          (32x32 ICO)`);

	console.log('\n🚀 All PWA icons generated successfully!');
}

generateIcons().catch((err) => {
	console.error('❌ Unexpected error during icon generation:', err);
	process.exit(1);
});
