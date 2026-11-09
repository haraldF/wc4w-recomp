/* GDI32: what the program asks about the screen (an 8-bit palette device, as under DirectDraw's
 * 640x480x8 mode) and palettes. Drawing with GDI (CreateDIBSection, StretchDIBits: the windowed
 * mode): 8-bit DIBs drawn whole as the frame the host shows. */
#include <algorithm>
#include <cstdio>
#include <vector>

#include "win.h"

void ddraw_show(const uint8_t *rows, uint32_t stride, int w, int h, const uint8_t rgb[256 * 3]); /* ddraw.cpp */

static uint32_t selected_palette; /* the LOGPALETTE (SelectPalette): DIB_PAL_COLORS index it */

API(GDI32, GetDeviceCaps, 2)
{
	switch (arg(1)) {
	case 8: return 640;      /* HORZRES */
	case 10: return 480;     /* VERTRES */
	case 12: return 8;       /* BITSPIXEL */
	case 14: return 1;       /* PLANES */
	case 38: return 0x100;   /* RASTERCAPS: RC_PALETTE */
	case 104: return 256;    /* SIZEPALETTE */
	case 106: return 20;     /* NUMRESERVED */
	case 108: return 18;     /* COLORRES */
	}
	return 0;
}

/* Palettes: the LOGPALETTE copied (version, count, entries) */
API(GDI32, CreatePalette, 1)
{
	uint32_t lp = arg(0), n = (uint32_t)mrd32(lp + 2, 2);
	uint32_t h = heap_alloc(4 + 4 * n);
	memcpy(M + h, M + lp, 4 + 4 * n);
	return h;
}

API(GDI32, SelectPalette, 3)
{
	uint32_t old = selected_palette;
	selected_palette = arg(1);
	return old ? old : arg(1);
}
API(GDI32, RealizePalette, 1) { return 0; }
API(GDI32, GetStockObject, 1) { return 0x40000 + arg(0); }
API(GDI32, DeleteObject, 1) { return 1; }

/* A DIB section: its bits in the program's memory (a region of their own), the BITMAPINFO kept
 * with them for drawing it later. */
API(GDI32, CreateDIBSection, 6)
{
	uint32_t bi = arg(1);
	int32_t w = (int32_t)rd32(bi + 4), h = (int32_t)rd32(bi + 8);
	uint32_t bpp = (uint32_t)mrd32(bi + 14, 2);
	uint32_t stride = ((uint32_t)w * bpp + 31) / 32 * 4, size = stride * (uint32_t)(h < 0 ? -h : h);
	uint32_t bits = region_alloc(0, size);
	if (!bits) return 0;
	if (arg(3)) wr32(arg(3), bits);
	uint32_t hbm = heap_alloc(16);
	wr32(hbm, bits);
	wr32(hbm + 4, (uint32_t)w);
	wr32(hbm + 8, (uint32_t)h);
	wr32(hbm + 12, bpp);
	if (wc_trace) fprintf(stderr, " [%dx%d, %u bits at %x]", w, h, bpp, bits);
	return hbm;
}

/* StretchDIBits(hdc, x, y, w, h, xSrc, ySrc, wSrc, hSrc, bits, bmi, usage, rop): an 8-bit DIB, its
 * colours from its table (DIB_RGB_COLORS: RGBQUADs) or the selected palette (DIB_PAL_COLORS: WORD
 * indices), shown unscaled from (0, 0); bottom-up DIBs (positive height) turned over. */
API(GDI32, StretchDIBits, 13)
{
	uint32_t bits = arg(9), bi = arg(10), usage = arg(11);
	int32_t w = (int32_t)rd32(bi + 4), h = (int32_t)rd32(bi + 8);
	uint32_t bpp = (uint32_t)mrd32(bi + 14, 2), header = rd32(bi), used = rd32(bi + 32);
	if (bpp != 8) {
		fprintf(stderr, "wc: StretchDIBits of a %u-bit DIB is not supported\n", bpp);
		return 0;
	}
	uint8_t rgb[256 * 3] = {};
	uint32_t table = bi + header, n = used ? std::min(used, 256u) : 256u;
	for (uint32_t i = 0; i < n; i++) {
		if (usage == 1) { /* DIB_PAL_COLORS */
			uint32_t k = (uint32_t)mrd32(table + 2 * i, 2);
			if (selected_palette && k < (uint32_t)mrd32(selected_palette + 2, 2)) {
				for (int c = 0; c < 3; c++) rgb[3 * i + c] = M[selected_palette + 4 + 4 * k + c];
			}
		}
		else {
			for (int c = 0; c < 3; c++) rgb[3 * i + c] = M[table + 4 * i + 2 - c];
		}
	}
	uint32_t stride = ((uint32_t)w + 3) & ~3u, rows = (uint32_t)(h < 0 ? -h : h);
	std::vector<uint8_t> top_down(stride * rows);
	for (uint32_t y = 0; y < rows; y++)
		memcpy(top_down.data() + y * stride, M + bits + (h < 0 ? y : rows - 1 - y) * stride, stride);
	ddraw_show(top_down.data(), stride, w, (int)rows, rgb);
	return rows;
}
