/**
 * Media Page
 * Contains Spicetify and DLC Unlocker pages
 * CSS classes match original renderer.js structure
 */

import { debug, escapeHtml, autoFadeStatus } from '../utils.js';
import { buttonStateManager } from '../managers.js';
import { toast } from '../components.js';

// ============================================
// SPICETIFY ICONS
// ============================================

const ICON_INSTALL_SPICETIFY = `
<svg xmlns="http://www.w3.org/2000/svg" version="1.0" width="56" height="56" viewBox="0 0 320.000000 400.000000" preserveAspectRatio="xMidYMid meet">
<metadata>Created by potrace 1.10, written by Peter Selinger 2001-2011</metadata>
<g transform="translate(0.000000,400.000000) scale(0.050000,-0.050000)" fill="currentColor" stroke="none">
<path d="M4327 7810 c-104 -108 -106 -138 -37 -370 192 -642 -47 -1035 -1034 -1701 -406 -275 -601 -425 -820 -633 -188 -179 -172 -180 -263 14 -254 544 -872 778 -1121 424 -56 -79 -58 -86 -32 -164 25 -76 54 -107 291 -314 l73 -64 -7 -286 -8 -286 -123 -300 c-67 -165 -172 -412 -231 -550 -350 -802 -354 -1595 -13 -2267 840 -1651 3123 -1657 3949 -10 251 499 293 746 285 1665 -8 942 37 1063 450 1204 184 62 300 237 240 363 -165 347 -916 227 -1211 -194 -84 -120 -52 1 60 225 652 1309 668 2334 49 3086 -222 271 -350 311 -497 158z m280 -186 c670 -643 653 -1813 -46 -3084 -246 -445 -277 -658 -105 -707 97 -28 156 14 267 187 167 263 194 298 279 359 176 128 536 194 743 136 89 -25 73 -89 -30 -115 -546 -138 -750 -575 -665 -1423 106 -1062 -230 -1903 -949 -2368 -1169 -756 -2760 -135 -3100 1211 -167 656 -104 1048 319 2018 384 881 377 1282 -29 1494 -194 102 -162 178 75 178 379 -1 734 -393 734 -811 0 -178 34 -167 282 91 276 286 501 469 949 770 1119 751 1413 1265 1129 1974 -85 211 -20 250 147 90z"/>
<path d="M2220 3249 c-534 -66 -689 -152 -612 -337 45 -108 115 -123 336 -75 727 162 1560 78 2166 -218 186 -91 252 -90 321 8 250 358 -1157 754 -2211 622z"/>
<path d="M2250 2551 c-472 -70 -612 -161 -489 -318 49 -62 107 -67 276 -25 573 143 1285 60 1817 -213 184 -94 248 -92 305 9 59 105 18 153 -239 280 -487 242 -1139 346 -1670 267z"/>
<path d="M2421 1900 c-439 -38 -601 -92 -601 -199 0 -116 24 -118 480 -50 478 70 951 2 1335 -195 169 -86 205 -92 253 -38 210 232 -743 544 -1467 482z"/>
</g>
</svg>
`;

const ICON_UNINSTALL_SPICETIFY = `
<svg xmlns="http://www.w3.org/2000/svg" version="1.0" width="56" height="56" viewBox="0 0 300.000000 375.000000" preserveAspectRatio="xMidYMid meet">
<metadata>Created by potrace 1.10, written by Peter Selinger 2001-2011</metadata>
<g transform="translate(0.000000,375.000000) scale(0.100000,-0.100000)" fill="currentColor" stroke="none">
<path d="M2335 3649 c-4 -6 -3 -21 3 -32 70 -152 82 -286 36 -412 -14 -38 -25 -76 -26 -82 -1 -7 -4 -13 -8 -13 -3 0 -14 -18 -24 -40 -22 -50 -146 -183 -241 -258 -98 -77 -250 -182 -264 -182 -6 0 -11 -4 -11 -10 0 -5 -4 -10 -10 -10 -19 0 -242 -172 -320 -246 -42 -41 -81 -74 -85 -74 -4 0 -4 10 0 23 21 70 41 433 25 472 -11 28 -18 -33 -25 -225 -13 -305 -9 -286 -56 -341 -22 -27 -47 -49 -55 -49 -19 0 -34 33 -34 76 0 54 -38 173 -69 213 -85 113 -191 167 -302 154 -61 -7 -70 -27 -24 -54 l35 -21 0 -284 c0 -240 2 -286 15 -290 25 -10 36 5 20 29 -11 17 -15 76 -17 279 -2 169 0 254 7 250 43 -25 67 -52 87 -96 19 -43 23 -67 23 -151 -1 -143 -34 -246 -175 -550 -31 -67 -99 -249 -115 -311 -29 -107 -34 -209 -19 -348 22 -203 89 -379 194 -509 51 -65 181 -197 192 -197 3 0 36 -20 73 -45 38 -25 89 -52 114 -62 25 -9 52 -21 59 -26 6 -5 12 -6 12 -2 0 4 7 2 15 -5 8 -7 15 -10 15 -7 0 3 24 -1 53 -10 87 -24 308 -29 407 -8 47 9 90 18 97 19 7 1 16 5 19 9 4 4 16 7 26 7 26 0 129 53 218 113 215 144 381 413 415 672 2 22 7 58 11 80 7 49 6 246 -1 335 -3 36 -5 112 -5 170 1 58 2 117 1 132 0 15 4 30 9 33 5 3 7 12 4 19 -3 8 0 17 5 21 6 3 9 11 6 16 -10 15 52 132 95 177 44 47 113 86 179 101 53 12 70 26 52 44 -8 8 -47 12 -119 12 -101 0 -111 -2 -174 -33 -74 -36 -139 -100 -178 -177 -29 -56 -83 -113 -115 -121 -28 -7 -85 23 -86 46 -1 22 2 84 5 101 7 36 15 52 136 289 84 165 188 439 174 461 -2 4 1 11 7 14 6 4 8 18 5 30 -3 13 -1 27 4 30 6 4 8 15 5 26 -4 10 -3 24 2 31 10 18 10 298 -1 298 -4 0 -5 11 -2 25 4 16 2 25 -5 25 -7 0 -9 9 -5 25 4 16 2 25 -5 25 -6 0 -9 6 -6 14 3 8 3 17 -1 20 -3 4 -7 16 -9 28 -3 19 -33 80 -85 169 -51 89 -167 195 -183 168z m95 -89 c55 -55 126 -185 161 -295 34 -107 39 -343 10 -486 -38 -192 -115 -387 -250 -637 -112 -206 -109 -326 11 -339 42 -5 49 -2 86 31 22 20 58 67 80 104 52 87 88 124 153 155 67 33 169 47 169 24 0 -8 -10 -17 -23 -20 -34 -9 -132 -102 -161 -153 -14 -25 -36 -78 -48 -118 -24 -77 -27 -175 -17 -546 4 -169 -1 -219 -42 -380 -26 -101 -106 -261 -175 -350 -114 -145 -321 -276 -509 -321 -110 -27 -293 -29 -400 -6 -335 72 -608 325 -703 652 -41 140 -56 355 -33 465 35 169 107 370 132 370 6 0 8 4 5 9 -3 5 9 42 28 82 59 128 123 311 136 388 21 125 -2 236 -58 290 -27 25 -36 41 -36 67 0 18 3 36 6 39 7 8 71 -24 117 -59 19 -14 41 -26 47 -26 7 0 16 -16 20 -35 3 -19 11 -33 16 -32 19 4 46 -96 49 -178 2 -80 2 -80 9 -25 6 47 7 49 8 17 4 -93 55 -123 111 -66 l31 31 1 -34 c1 -32 2 -31 8 8 4 22 17 54 29 71 25 35 154 157 192 182 14 9 33 23 43 32 19 17 292 205 325 224 41 24 192 144 243 195 199 198 262 396 199 628 -11 40 -20 75 -20 78 0 7 24 -11 50 -36z"/>
<path d="M1343 1845 c0 -33 2 -45 4 -27 2 18 2 45 0 60 -2 15 -4 0 -4 -33z"/>
<path d="M1375 1600 c-132 -11 -302 -46 -343 -72 -40 -25 -52 -46 -52 -95 0 -45 20 -77 60 -98 36 -19 63 -19 137 0 91 23 127 27 296 32 261 8 467 -28 680 -121 58 -26 114 -46 124 -46 28 0 85 41 100 70 45 89 -33 164 -253 241 -212 74 -506 109 -749 89z m375 -35 c25 -3 56 -5 70 -6 50 -2 238 -51 325 -86 141 -56 183 -80 201 -114 31 -61 -4 -129 -67 -129 -15 0 -58 14 -96 31 -202 92 -365 129 -608 136 -183 6 -284 -4 -437 -41 -49 -12 -61 -12 -85 0 -38 20 -53 42 -53 79 0 39 36 82 77 90 15 4 51 13 78 20 28 8 59 14 70 14 37 0 104 7 109 12 6 6 359 1 416 -6z"/>
<path d="M1305 1264 c-214 -36 -250 -53 -262 -127 -4 -27 0 -43 16 -66 33 -45 70 -51 171 -27 69 16 120 20 275 20 166 0 201 -2 279 -22 106 -28 189 -58 273 -101 81 -40 125 -41 164 -2 39 39 39 87 2 132 -53 62 -280 153 -458 184 -121 21 -363 25 -460 9z m390 -25 c89 -12 211 -43 295 -75 98 -38 199 -86 215 -104 37 -41 22 -106 -28 -123 -21 -7 -37 -4 -68 12 -121 64 -295 120 -431 142 -114 17 -352 7 -452 -21 -83 -22 -114 -21 -140 6 -19 19 -21 73 -3 97 40 56 405 95 612 66z"/>
<path d="M1335 955 c-49 -7 -116 -18 -147 -24 -96 -20 -135 -84 -88 -144 28 -36 65 -41 156 -20 58 13 125 17 249 18 198 0 270 -15 435 -90 53 -25 104 -45 113 -45 9 0 31 13 48 28 59 53 36 112 -67 169 -65 36 -217 87 -307 102 -96 17 -295 20 -392 6z m365 -29 c47 -8 112 -23 145 -34 222 -74 288 -120 256 -181 -24 -44 -43 -43 -137 3 -102 49 -193 81 -279 95 -84 15 -344 7 -433 -13 -95 -21 -107 -20 -132 6 -26 28 -25 44 3 71 20 21 94 39 247 61 65 9 254 4 330 -8z"/>
</g>
</svg>
`;

const ICON_FULL_UNINSTALL_SPOTIFY = `
<svg xmlns="http://www.w3.org/2000/svg" version="1.0" width="48" height="48" viewBox="0 0 600.000000 600.000000" preserveAspectRatio="xMidYMid meet">
<metadata>Created by potrace 1.10, written by Peter Selinger 2001-2011</metadata>
<g transform="translate(0.000000,600.000000) scale(0.100000,-0.100000)" fill="currentColor" stroke="none">
<path d="M250 5830 c-19 -5 -51 -13 -70 -19 -19 -6 -56 -16 -81 -23 -52 -15 -79 -34 -79 -54 0 -11 19 -14 83 -14 113 -1 198 -31 302 -109 94 -71 183 -168 265 -291 8 -13 23 -31 34 -41 26 -25 14 -46 -41 -70 -27 -11 -65 -29 -86 -40 -21 -10 -44 -19 -52 -19 -17 0 -34 -30 -28 -47 3 -7 15 -13 29 -13 25 0 92 -22 136 -46 14 -8 33 -14 41 -14 9 0 28 -6 44 -14 36 -18 87 -40 143 -61 25 -10 57 -23 72 -31 14 -8 31 -14 36 -14 6 0 40 -14 76 -30 37 -17 71 -28 76 -25 6 3 10 32 10 64 0 32 5 71 10 88 6 16 15 67 19 114 11 102 27 205 51 321 23 112 16 120 -65 68 -33 -22 -73 -50 -90 -64 -35 -29 -75 -34 -75 -10 0 26 -58 114 -114 173 -103 107 -222 180 -352 215 -64 17 -231 20 -294 6z m340 -108 c118 -47 225 -131 316 -247 50 -64 106 -98 164 -99 27 -1 54 -6 60 -12 23 -23 -26 -350 -55 -374 -18 -15 -92 1 -143 31 -18 10 -41 19 -50 20 -9 0 -51 17 -92 37 -84 42 -96 62 -61 111 32 45 35 80 11 135 -39 93 -110 185 -227 295 -135 127 -141 147 -46 136 32 -4 87 -18 123 -33z"/>
<path d="M1150 5749 c-21 -30 -22 -34 -7 -58 15 -25 56 -49 282 -166 61 -31 214 -110 340 -176 127 -65 271 -139 320 -164 50 -26 97 -50 105 -55 8 -5 22 -11 30 -15 8 -3 81 -41 162 -83 278 -146 513 -264 553 -278 37 -12 41 -12 62 8 18 17 29 19 60 13 21 -4 44 -12 51 -17 7 -6 15 -8 19 -4 11 11 -19 55 -46 66 -14 6 -66 33 -116 60 -49 27 -97 52 -105 55 -8 4 -22 10 -30 15 -33 20 -155 76 -182 84 -27 8 -22 27 27 102 56 85 59 120 13 163 -18 17 -38 31 -43 31 -6 0 -44 18 -85 39 -116 61 -343 178 -470 244 -63 32 -133 70 -155 83 -22 13 -57 23 -77 24 -33 0 -42 -5 -68 -42 -16 -22 -30 -49 -30 -60 0 -10 -4 -18 -9 -18 -5 0 -12 -16 -15 -35 -6 -28 -12 -35 -30 -35 -13 0 -34 8 -47 18 -31 22 -49 32 -193 107 -199 103 -206 107 -212 116 -3 5 -22 9 -43 9 -30 0 -42 -6 -61 -31z m935 -221 c88 -45 192 -97 230 -116 39 -18 77 -38 85 -43 8 -5 50 -27 93 -50 73 -39 127 -87 127 -112 0 -7 -11 -43 -24 -82 -29 -87 -45 -91 -143 -42 -240 120 -646 329 -668 343 -53 34 -51 48 11 119 78 88 84 88 289 -17z"/>
<path d="M663 4774 c-11 -17 -11 -31 -3 -65 6 -24 15 -132 20 -240 4 -108 13 -247 19 -310 11 -121 27 -369 41 -659 5 -96 13 -220 19 -275 6 -55 13 -177 16 -271 10 -289 32 -314 270 -314 141 0 165 4 165 26 0 25 -54 41 -160 48 -156 10 -181 33 -195 171 -6 64 -29 421 -45 695 -5 91 -14 230 -19 310 -54 775 -54 796 -8 822 17 9 210 11 827 10 443 -2 812 -5 820 -7 9 -3 23 -21 33 -40 9 -19 25 -50 34 -69 20 -41 30 -38 38 12 3 20 10 59 16 85 9 38 8 52 -2 68 -14 20 -23 20 -943 22 l-929 2 -14 -21z"/>
<path d="M3331 4749 c-41 -5 -99 -15 -130 -23 -39 -10 -59 -11 -72 -3 -18 11 -79 -12 -107 -40 -7 -7 -29 -13 -47 -13 -19 0 -46 -5 -62 -11 -15 -6 -41 -15 -58 -20 -64 -17 -150 -50 -182 -69 -19 -11 -39 -20 -44 -20 -5 0 -23 -10 -39 -21 -17 13 -35 19 -45 15 -11 4 -31 -5 -53 -22 -21 -16 -45 -32 -54 -35 -10 -4 -18 -11 -18 -17 0 -5 -8 -10 -19 -10 -10 0 -24 -7 -31 -15 -7 -8 -18 -15 -25 -15 -7 0 -15 -7 -19 -15 -3 -8 -13 -15 -23 -15 -10 0 -31 -14 -47 -30 -16 -17 -36 -30 -45 -30 -9 0 -24 -14 -33 -30 -9 -17 -24 -30 -32 -30 -8 0 -19 -6 -23 -13 -4 -7 -28 -28 -53 -47 -109 -82 -356 -360 -396 -445 -8 -16 -23 -43 -34 -60 -10 -16 -29 -50 -42 -74 -13 -25 -35 -58 -50 -75 -16 -17 -28 -40 -28 -52 0 -12 -7 -27 -15 -34 -8 -7 -15 -23 -15 -35 0 -12 -7 -28 -15 -35 -8 -7 -15 -20 -15 -29 0 -9 -7 -25 -15 -35 -8 -11 -15 -32 -15 -47 0 -14 -7 -32 -15 -39 -8 -7 -15 -24 -15 -39 0 -14 -7 -35 -15 -45 -8 -11 -15 -36 -15 -56 0 -20 -4 -40 -9 -45 -12 -13 -42 -154 -50 -235 -4 -36 -12 -74 -18 -85 -8 -15 -11 -92 -9 -250 3 -239 20 -416 43 -450 7 -11 13 -33 13 -50 0 -16 5 -46 11 -65 6 -19 15 -53 19 -75 9 -46 27 -98 46 -137 8 -14 14 -34 14 -43 0 -9 6 -29 14 -43 8 -15 22 -47 32 -72 10 -25 24 -52 31 -61 7 -8 13 -23 13 -31 0 -9 7 -21 15 -28 8 -7 15 -21 15 -31 0 -10 4 -21 10 -24 5 -3 21 -30 35 -58 98 -198 372 -505 614 -685 81 -60 95 -70 151 -102 19 -11 53 -31 75 -44 82 -51 307 -156 333 -156 10 0 27 -7 38 -15 10 -8 28 -15 40 -15 11 0 24 -4 30 -9 9 -10 49 -21 144 -42 25 -6 72 -17 105 -25 129 -30 219 -40 387 -42 193 -2 397 16 513 46 36 10 92 22 180 39 17 3 35 9 40 14 6 4 44 19 85 32 90 30 109 37 225 92 50 24 97 46 105 49 17 8 36 19 97 59 24 15 45 27 48 27 9 0 80 51 195 141 97 76 360 335 360 355 0 6 34 49 75 96 8 10 15 21 15 24 0 3 13 23 28 43 16 20 32 43 35 51 4 8 16 29 27 45 10 17 30 53 45 80 14 28 29 57 34 65 9 14 46 95 84 183 10 21 17 46 17 55 0 10 5 23 11 29 6 6 14 26 19 44 4 19 13 48 19 64 25 75 41 140 41 172 0 19 6 44 12 56 7 12 15 56 19 97 3 41 12 116 19 165 14 101 7 412 -10 429 -6 6 -10 34 -10 64 0 29 -5 62 -11 73 -6 11 -16 57 -24 102 -16 102 -34 166 -71 255 -8 18 -14 40 -14 48 0 9 -6 28 -14 42 -7 15 -28 59 -46 97 -17 39 -36 77 -41 85 -5 8 -11 21 -14 28 -13 32 -16 39 -35 67 -11 17 -24 39 -30 50 -41 76 -137 214 -210 300 -66 78 -283 287 -355 341 -120 91 -242 167 -375 233 -25 12 -52 26 -60 30 -14 8 -31 16 -123 55 -21 9 -42 16 -48 16 -6 0 -25 6 -42 14 -18 7 -59 21 -92 31 -33 10 -71 22 -85 26 -14 5 -56 13 -94 19 -38 6 -74 14 -79 17 -6 4 -49 10 -96 15 -47 4 -108 12 -136 17 -61 12 -313 12 -414 0z m225 -77 c10 -5 73 -13 139 -16 138 -8 213 -17 305 -39 36 -8 97 -22 135 -31 69 -15 125 -33 235 -76 30 -12 68 -25 83 -30 16 -5 47 -20 70 -33 23 -13 54 -27 69 -31 14 -3 40 -17 56 -31 17 -14 33 -25 38 -25 4 0 24 -11 43 -24 20 -13 70 -45 111 -71 67 -44 236 -179 264 -213 6 -8 29 -33 51 -57 93 -98 202 -230 227 -271 10 -16 23 -38 30 -49 48 -76 65 -105 86 -145 13 -25 30 -56 37 -70 30 -54 84 -179 91 -206 4 -16 12 -40 19 -54 37 -73 72 -212 100 -391 8 -53 19 -108 24 -122 10 -26 8 -398 -2 -415 -3 -4 -8 -46 -11 -93 -6 -89 -16 -141 -47 -254 -11 -38 -25 -88 -30 -110 -6 -22 -22 -64 -35 -93 -13 -29 -24 -59 -24 -67 0 -8 -30 -77 -67 -153 -57 -117 -122 -224 -238 -392 -43 -62 -212 -244 -258 -277 -39 -28 -110 -88 -149 -126 -16 -15 -34 -27 -41 -27 -8 0 -26 -14 -42 -30 -16 -17 -35 -30 -43 -30 -7 0 -28 -11 -45 -24 -18 -13 -50 -33 -72 -45 -22 -12 -51 -28 -65 -36 -51 -30 -250 -115 -268 -115 -10 0 -22 -4 -28 -9 -9 -10 -77 -30 -269 -80 -80 -21 -155 -32 -275 -40 -91 -7 -189 -16 -219 -21 -30 -6 -85 -10 -122 -10 -180 0 -565 142 -782 288 -126 86 -151 103 -157 110 -4 6 -42 36 -108 87 -53 40 -223 219 -295 310 -48 61 -90 115 -95 120 -4 6 -11 17 -15 25 -4 8 -16 29 -27 45 -11 17 -25 42 -31 58 -6 15 -14 27 -19 27 -6 0 -118 219 -151 295 -28 65 -84 244 -105 335 -8 36 -19 83 -24 105 -5 22 -9 58 -10 81 0 22 -4 44 -9 50 -5 5 -12 95 -16 199 -4 105 -9 192 -11 194 -12 13 -21 -63 -22 -184 -1 -106 5 -174 23 -280 25 -149 40 -218 54 -250 9 -20 26 -82 40 -145 5 -19 20 -57 33 -85 14 -27 34 -72 43 -100 10 -27 23 -55 31 -61 7 -6 20 -33 34 -55 9 -27 22 -54 30 -59 7 -6 22 -30 34 -55 51 -104 127 -217 153 -228 5 -2 8 -8 8 -14 0 -6 15 -27 32 -48 52 -58 88 -102 88 -105 0 -1 32 -35 70 -75 40 -42 69 -79 66 -87 -4 -10 1 -12 18 -7 19 4 25 1 30 -19 4 -16 17 -29 36 -35 16 -6 30 -18 30 -26 0 -23 -25 -19 -56 9 -14 13 -35 27 -47 31 -11 3 -41 26 -66 50 -25 24 -50 44 -55 44 -6 0 -24 14 -40 30 -17 17 -67 65 -112 108 -44 42 -83 85 -87 95 -3 9 -12 17 -19 17 -7 0 -23 15 -36 33 -12 17 -37 52 -56 77 -44 58 -162 249 -175 283 -6 14 -21 43 -34 64 -13 21 -32 63 -42 93 -10 30 -31 81 -46 113 -16 33 -27 63 -24 68 3 5 -1 19 -9 31 -8 13 -22 57 -31 98 -9 41 -25 104 -35 140 -19 63 -45 313 -35 330 10 15 -13 207 -26 228 -31 49 2 53 461 52 202 -1 260 -4 282 -17 4 -2 -11 -21 -33 -42 -65 -65 -75 -127 -38 -225 29 -79 97 -150 183 -192 90 -43 111 -44 321 -4 56 11 205 28 310 36 236 19 817 -13 905 -48 8 -4 40 -9 70 -13 96 -11 425 -102 492 -136 10 -5 26 -9 36 -9 9 0 27 -7 38 -15 12 -8 61 -27 110 -43 79 -26 99 -29 173 -24 65 4 93 10 120 28 127 81 180 159 188 279 3 56 1 76 -14 102 -10 17 -30 54 -46 82 -39 72 -80 100 -262 181 -22 10 -56 24 -75 31 -19 7 -44 19 -55 26 -11 7 -28 13 -38 13 -20 0 -127 34 -174 56 -17 7 -45 14 -61 14 -17 0 -33 4 -36 9 -5 8 -52 19 -171 40 -27 5 -102 19 -165 30 -187 36 -209 39 -340 54 -89 10 -222 13 -460 12 -375 -3 -488 -16 -566 -61 -24 -14 -48 -23 -53 -20 -22 14 -20 131 4 154 3 3 21 -2 40 -12 38 -21 46 -20 435 4 354 22 885 -34 1247 -131 39 -10 79 -19 88 -19 8 0 33 -9 53 -19 21 -11 64 -24 97 -30 32 -6 77 -20 99 -30 23 -10 66 -27 96 -36 30 -10 74 -28 97 -41 23 -13 48 -24 56 -24 8 0 27 -7 43 -14 102 -51 304 -49 371 4 14 11 31 20 37 20 17 0 110 127 136 185 35 81 35 140 1 217 -16 35 -37 70 -45 77 -9 8 -16 19 -16 26 0 39 -206 167 -306 191 -16 3 -42 14 -59 24 -16 9 -100 40 -185 69 -85 28 -168 56 -185 62 -67 24 -299 80 -430 105 -44 8 -94 19 -112 25 -17 5 -76 14 -130 19 -54 5 -114 14 -133 19 -19 6 -73 12 -120 15 -47 2 -125 8 -175 13 -49 4 -223 8 -385 8 -316 0 -436 -12 -501 -47 -20 -11 -47 -18 -60 -16 l-24 3 2 125 c1 69 5 206 10 305 5 99 5 193 1 209 -6 22 -2 38 14 64 14 23 21 49 20 76 -3 52 9 70 37 61 23 -7 27 -25 9 -43 -35 -35 26 -18 91 25 44 30 277 143 364 177 116 46 320 86 413 82 44 -2 89 -8 100 -14z m-1156 -402 c-33 -33 -60 -64 -60 -70 0 -10 -52 -40 -70 -40 -14 0 -13 27 1 32 7 2 17 19 23 38 8 26 25 41 71 66 93 52 104 43 35 -26z m70 -31 c0 -11 -4 -29 -10 -39 -5 -10 -12 -73 -15 -141 -3 -68 -9 -173 -14 -234 -5 -60 -6 -113 -4 -118 7 -12 -37 -66 -67 -82 -40 -21 -63 -19 -87 8 -19 20 -21 36 -25 189 -1 91 -7 170 -11 175 -5 4 -17 -3 -28 -16 -17 -21 -19 -41 -20 -195 0 -94 -3 -189 -7 -211 -6 -35 -11 -40 -37 -43 -17 -2 -34 -8 -40 -13 -15 -15 -42 -10 -50 9 -4 9 -9 63 -12 120 -5 88 -8 102 -23 102 -19 0 -29 -32 -34 -105 -5 -74 -38 -177 -67 -209 -15 -18 -31 -44 -34 -59 -4 -15 -11 -30 -16 -33 -5 -3 -9 -23 -9 -45 0 -21 -5 -48 -12 -59 -10 -15 -10 -27 1 -55 7 -19 10 -43 7 -53 -4 -10 1 -27 9 -38 8 -10 15 -26 15 -35 0 -18 112 -132 150 -154 73 -42 99 -49 204 -54 68 -4 111 -10 113 -17 4 -12 -68 -54 -93 -54 -24 0 -125 -38 -143 -54 -13 -11 -61 -15 -231 -18 -170 -2 -220 -6 -238 -18 -22 -14 -25 -13 -39 8 -18 26 -35 28 -68 6 -20 -13 -30 -13 -67 -3 -67 20 -70 24 -65 103 7 108 54 287 78 302 5 3 30 -8 55 -25 25 -17 49 -31 54 -31 5 0 15 -10 21 -22 l12 -22 24 28 c13 15 21 31 18 36 -2 4 -25 5 -50 2 -32 -3 -45 -1 -45 8 0 7 -7 18 -15 24 -14 10 -14 32 -5 173 l10 162 47 86 c26 47 52 85 59 85 31 0 37 -42 32 -227 -4 -140 -2 -183 8 -183 13 0 24 22 24 50 0 10 15 64 34 120 l33 102 -25 -5 -25 -5 6 100 c6 88 11 109 42 172 35 72 148 206 173 206 6 0 12 -10 12 -23 0 -41 -28 -158 -44 -182 -26 -39 -18 -50 11 -16 15 17 32 31 38 31 6 0 24 25 40 56 27 52 29 63 30 175 l0 120 55 48 c35 31 59 46 65 40 5 -5 10 -45 10 -89 0 -44 4 -81 10 -83 5 -1 19 13 30 31 32 54 85 111 150 163 65 53 95 61 95 28z m940 -670 c107 -5 227 -15 265 -20 39 -6 111 -14 161 -18 50 -4 97 -12 105 -17 8 -4 37 -11 64 -15 71 -9 195 -35 228 -48 16 -6 41 -11 56 -11 15 0 47 -6 72 -14 24 -8 91 -28 149 -45 58 -18 119 -37 135 -42 17 -6 44 -14 60 -18 17 -4 39 -13 50 -19 11 -6 49 -21 85 -33 70 -24 108 -38 155 -58 45 -20 85 -37 132 -56 23 -10 44 -24 47 -31 3 -8 10 -14 16 -14 23 0 49 -36 95 -131 19 -41 17 -106 -6 -173 -17 -48 -91 -127 -147 -155 -52 -26 -163 -29 -219 -5 -73 31 -103 44 -135 58 -78 34 -105 44 -135 51 -18 3 -35 11 -38 16 -4 5 -13 9 -22 9 -8 0 -29 6 -46 14 -18 7 -59 21 -92 31 -33 9 -73 21 -90 27 -16 5 -46 14 -65 18 -16 5 -75 20 -130 31 -55 12 -116 25 -136 31 -20 5 -52 9 -70 9 -19 0 -56 7 -83 15 -27 8 -72 15 -100 15 -28 0 -67 4 -86 10 -28 8 -405 33 -505 33 -99 1 -479 -25 -494 -33 -10 -5 -58 -11 -108 -13 -49 -2 -99 -9 -110 -16 -12 -6 -40 -11 -63 -11 -23 0 -51 -5 -63 -12 -34 -18 -126 -20 -151 -3 -11 8 -27 15 -36 15 -27 0 -150 130 -150 159 0 7 -7 22 -15 34 -17 26 -15 111 3 129 7 7 12 21 12 31 0 11 26 46 57 79 32 32 61 65 66 73 4 8 17 15 28 15 11 0 31 7 44 16 20 13 28 14 40 4 17 -14 85 -5 129 17 19 10 51 14 95 12 51 -3 74 1 94 14 21 13 50 17 139 18 62 0 187 7 278 14 91 7 197 11 235 9 39 -2 158 -9 265 -15z m0 -802 c25 -3 90 -8 145 -11 55 -4 132 -13 170 -21 39 -7 111 -21 160 -30 50 -10 112 -23 139 -31 27 -8 66 -14 85 -14 20 0 45 -7 55 -15 11 -8 34 -15 51 -15 17 0 35 -4 40 -9 6 -6 28 -14 50 -20 91 -23 183 -53 242 -78 18 -7 47 -20 65 -27 18 -8 53 -22 78 -31 111 -43 174 -99 195 -174 13 -45 1 -158 -20 -181 -8 -9 -15 -21 -15 -27 0 -17 -100 -79 -151 -92 -38 -11 -54 -10 -96 2 -28 8 -59 20 -69 25 -11 5 -39 18 -64 27 -25 9 -58 23 -73 31 -16 8 -37 14 -47 14 -18 0 -67 18 -113 42 -10 5 -39 13 -65 18 -26 6 -78 19 -117 31 -38 11 -90 24 -115 29 -25 5 -63 13 -85 18 -80 20 -172 35 -260 43 -49 5 -121 13 -160 18 -90 13 -548 13 -645 0 -41 -5 -111 -14 -155 -18 -44 -5 -102 -14 -130 -19 -27 -6 -87 -15 -132 -22 -81 -11 -84 -10 -140 17 -43 21 -67 43 -100 87 -41 55 -43 62 -43 126 0 105 27 146 128 199 52 27 71 32 102 27 29 -4 48 -1 72 13 60 35 163 51 443 67 49 3 92 8 95 11 5 5 404 -3 480 -10z m-916 -2198 c-6 -11 -44 8 -44 21 0 6 10 5 25 -2 13 -6 22 -15 19 -19z"/>
<path d="M2969 2145 c-3 -3 -42 -8 -85 -10 -255 -16 -445 -47 -604 -98 -92 -30 -201 -129 -216 -195 -3 -15 -10 -39 -16 -53 -19 -52 16 -153 76 -217 38 -41 105 -82 151 -92 45 -10 194 5 335 34 360 76 974 45 1300 -64 36 -12 90 -29 120 -37 30 -8 78 -25 107 -38 28 -14 59 -25 68 -25 9 0 30 -8 48 -17 34 -18 92 -31 169 -40 38 -4 56 0 95 22 78 42 117 84 162 174 18 35 21 53 16 95 -10 85 -15 102 -34 123 -10 11 -30 38 -45 61 -14 23 -31 42 -37 42 -6 0 -25 11 -42 24 -43 32 -294 131 -399 157 -20 5 -61 17 -90 28 -29 10 -78 23 -108 29 -30 6 -68 14 -85 17 -16 4 -50 10 -75 14 -25 4 -56 13 -70 19 -14 6 -99 16 -190 22 -91 6 -196 15 -235 20 -82 9 -308 13 -316 5z m496 -113 c129 -13 312 -41 341 -52 14 -6 39 -10 55 -10 17 0 39 -5 50 -10 10 -6 38 -14 61 -19 24 -5 57 -14 73 -19 17 -6 57 -18 90 -28 72 -20 170 -55 250 -89 17 -7 50 -21 75 -31 106 -43 150 -101 150 -197 0 -34 -4 -67 -8 -74 -67 -106 -173 -157 -249 -119 -15 8 -46 22 -68 32 -22 9 -48 21 -59 26 -10 5 -53 21 -95 34 -42 13 -85 28 -96 33 -39 16 -121 39 -195 55 -41 9 -97 22 -125 28 -195 45 -419 61 -725 53 -164 -4 -248 -10 -275 -20 -22 -8 -60 -14 -84 -15 -24 0 -67 -6 -95 -14 -79 -23 -191 -46 -219 -46 -39 0 -72 16 -117 56 -41 38 -80 109 -80 149 0 41 40 114 80 146 45 36 128 69 175 69 16 0 46 5 65 11 56 17 216 40 338 49 62 4 116 11 120 15 9 9 449 -2 567 -13z"/>
<path d="M1880 3649 c0 -11 5 -17 10 -14 6 3 10 13 10 21 0 8 -4 14 -10 14 -5 0 -10 -9 -10 -21z"/>
<path d="M2425 3426 c-23 -39 -26 -58 -32 -174 -5 -111 -3 -138 11 -177 17 -43 36 -60 36 -32 0 6 7 66 15 132 17 138 20 295 5 295 -5 0 -21 -20 -35 -44z"/>
<path d="M2196 3413 c-3 -3 -6 -72 -6 -152 -1 -128 -3 -149 -19 -168 -11 -13 -30 -23 -45 -23 -14 0 -26 -4 -26 -10 0 -29 121 13 135 47 10 24 26 113 25 138 -1 11 -2 45 -3 75 -2 30 -6 61 -10 67 -11 18 -43 34 -51 26z"/>
<path d="M2016 3256 c-4 -15 -4 -37 0 -49 7 -21 8 -20 15 6 4 16 4 38 0 50 -7 20 -8 19 -15 -7z"/>
<path d="M1045 4359 c-67 -59 -65 -40 -65 -649 0 -608 -2 -585 65 -652 41 -42 64 -46 119 -23 26 11 42 28 61 65 14 27 25 58 25 68 0 10 3 21 6 24 3 3 5 245 4 538 0 422 -3 539 -14 564 -22 51 -69 88 -119 93 -39 5 -48 2 -82 -28z m120 -31 l26 -23 0 -598 c1 -673 5 -637 -72 -637 -73 0 -70 -26 -71 637 l0 588 25 28 c30 33 57 34 92 5z"/>
<path d="M1574 4380 c-29 -12 -70 -63 -84 -106 -9 -27 -11 -112 -8 -316 4 -252 6 -280 23 -298 18 -20 19 -20 29 -3 7 11 12 133 13 333 l2 315 26 23 c34 29 56 28 94 -4 l31 -26 0 -183 c0 -106 4 -186 10 -190 30 -19 65 284 41 357 -17 52 -82 108 -124 107 -17 0 -41 -4 -53 -9z"/>
<path d="M2040 4340 c-22 -22 -40 -48 -40 -57 0 -13 2 -14 17 -2 10 8 28 26 41 41 12 15 34 28 48 30 32 4 32 22 0 26 -19 2 -36 -7 -66 -38z"/>
</g>
</svg>
`;

// ============================================
// SPICETIFY PAGE (Original Structure)
// ============================================

export function buildSpicetifyPage(translations, settings) {
    const container = document.createElement('div');
    container.className = 'card';

    const pageTitle = document.createElement('h2');
    pageTitle.textContent = translations.pages?.spicetify_title || 'Install Spicetify';
    container.appendChild(pageTitle);

    const pageDesc = document.createElement('p');
    pageDesc.textContent = translations.pages?.spicetify_desc || 'Adds themes and customizations to Spotify for a better experience.';
    pageDesc.classList.add('page-desc');
    container.appendChild(pageDesc);

    const grid = document.createElement('div');
    grid.className = 'install-grid';

    const outputPre = document.createElement('pre');
    outputPre.className = 'status-pre';

    // Helper function for running Spicetify actions
    async function runAction(action, successMsg, errorMsg, button) {
        button.disabled = true;
        const originalText = button.textContent;
        button.textContent = (translations.general?.run || 'Run') + '...';
        try {
            const result = await action();
            outputPre.textContent = result.output || '';
            if (result.success) {
                toast(successMsg, { type: 'success', title: translations.menu?.spicetify || 'Spicetify' });
                button.textContent = '✓ ' + originalText;
                button.classList.add('success');
                setTimeout(() => { button.textContent = originalText; button.classList.remove('success'); }, 2000);
            } else {
                throw new Error(result.error);
            }
        } catch (err) {
            outputPre.textContent = '';
            toast(errorMsg + `: ${err.message}`, { type: 'error', title: translations.menu?.spicetify || 'Spicetify', duration: 6000 });
            button.textContent = '✗ ' + originalText;
            button.classList.add('error');
            setTimeout(() => { button.textContent = originalText; button.classList.remove('error'); }, 2000);
        } finally {
            button.disabled = false;
        }
    }

    // Helper to build card header (original structure)
    function buildHeader(svgHTML, titleTxt, descTxt) {
        const header = document.createElement('div');
        header.className = 'app-header';

        const iconWrap = document.createElement('div');
        iconWrap.className = 'app-icon';
        iconWrap.innerHTML = svgHTML;

        const textBox = document.createElement('div');
        const h3 = document.createElement('h3');
        h3.textContent = titleTxt;
        const p = document.createElement('p');
        p.textContent = descTxt;

        textBox.appendChild(h3);
        textBox.appendChild(p);

        header.appendChild(iconWrap);
        header.appendChild(textBox);
        return header;
    }

    // Helper to create cards (original structure)
    const makeCard = (svg, title, desc, btnLabel, onClick) => {
        const card = document.createElement('div');
        card.className = 'app-card';
        card.appendChild(buildHeader(svg, title, desc));
        const btn = document.createElement('button');
        btn.className = 'button';
        btn.textContent = btnLabel;
        btn.addEventListener('click', () => onClick(btn));
        card.appendChild(btn);
        return card;
    };

    // Install Spicetify Card
    const installCard = makeCard(
        ICON_INSTALL_SPICETIFY,
        translations.actions?.install_spicetify || 'Install Spicetify',
        translations.pages?.spicetify_desc || 'Adds themes and customizations to Spotify for a better experience.',
        translations.actions?.install || 'Install',
        (btn) => runAction(
            () => window.api.installSpicetify(),
            translations.messages?.install_spicetify_success || 'Spicetify installed successfully!',
            translations.messages?.install_spicetify_error || 'Error installing Spicetify',
            btn
        )
    );

    // Uninstall Spicetify Card
    const uninstallCard = makeCard(
        ICON_UNINSTALL_SPICETIFY,
        translations.actions?.uninstall_spicetify || 'Uninstall Spicetify',
        translations.general?.not_implemented || 'Completely remove Spicetify and restore Spotify to its default state',
        translations.general?.cancel || 'Cancel',
        (btn) => runAction(
            () => window.api.uninstallSpicetify(),
            translations.messages?.uninstall_spicetify_success || 'Spicetify uninstalled successfully!',
            translations.messages?.uninstall_spicetify_error || 'Error uninstalling Spicetify',
            btn
        )
    );

    // Full Uninstall Spotify Card
    const fullUninstallCard = makeCard(
        ICON_FULL_UNINSTALL_SPOTIFY,
        translations.actions?.full_uninstall_spotify || 'Full Uninstall Spotify',
        translations.general?.not_implemented || 'Complete removal of both Spotify and Spicetify',
        translations.actions?.full_uninstall_spotify || 'Full Uninstall Spotify',
        (btn) => runAction(
            () => window.api.fullUninstallSpotify(),
            translations.messages?.full_uninstall_spotify_success || 'Spotify fully uninstalled!',
            translations.messages?.full_uninstall_spotify_error || 'Error fully uninstalling Spotify',
            btn
        )
    );
    fullUninstallCard.classList.add('full-span');

    grid.appendChild(installCard);
    grid.appendChild(uninstallCard);
    grid.appendChild(fullUninstallCard);

    container.appendChild(grid);
    container.appendChild(outputPre);
    return container;
}

// ============================================
// DLC UNLOCKER PAGE (Original Structure)
// ============================================

export async function buildDlcUnlockerPage(translations, settings) {
    const container = document.createElement('div');
    container.className = 'card dlc-scope';

    // Overlay image
    const overlayImage = document.createElement('div');
    overlayImage.className = 'dlc-overlay-image';

    const simsImage = document.createElement('img');
    simsImage.src = await window.api.getAssetPath('images/sims.png');
    simsImage.alt = 'DLC Unlocker';
    simsImage.className = 'dlc-overlay-img';
    overlayImage.appendChild(simsImage);
    container.appendChild(overlayImage);

    const pageTitle = document.createElement('h2');
    pageTitle.textContent = (translations.pages && translations.pages.dlc_title) || 'DLC Unlocker';
    container.appendChild(pageTitle);

    const pageDesc = document.createElement('p');
    pageDesc.textContent = (translations.pages && translations.pages.dlc_desc) || 'Choose the appropriate tool to unlock DLCs for EA games and The Sims. Use the Sims Installer for the complete Sims DLC package or the EA Unlocker to access all EA game content.';
    pageDesc.classList.add('page-desc');
    container.appendChild(pageDesc);

    const grid = document.createElement('div');
    grid.className = 'install-grid dlc-grid';
    container.appendChild(grid);

    // Helper for DLC download
    async function downloadAndExtractDLC(button, status, key, url, name) {
        if (button.disabled) return;

        const originalText = button.innerHTML;
        button.disabled = true;
        button.innerHTML = 'Preparing...';
        status.textContent = '';
        status.classList.add('show');

        const downloadId = `dlc-${key}-${Date.now()}`;

        const unsubscribe = window.api.onDownloadEvent((data) => {
            if (data.id !== downloadId) return;

            switch (data.status) {
                case 'started':
                    button.innerHTML = `Downloading ${name}... 0%`;
                    status.textContent = 'Download started...';
                    break;
                case 'progress':
                    button.innerHTML = `Downloading... ${data.percent}%`;
                    status.textContent = `Downloading: ${data.percent}%`;
                    break;
                case 'complete':
                    button.innerHTML = `Extracting ${name}...`;
                    status.textContent = 'Download complete. Extracting...';

                    window.api.extractArchive(data.path)
                        .then((result) => {
                            if (result && result.success) {
                                status.textContent = `Extracted to: ${result.extractedPath || 'Downloads folder'}`;
                                toast(`${name} extracted successfully!`, { type: 'success', title: 'DLC Unlocker' });
                                button.innerHTML = '✓ Complete';
                                setTimeout(() => {
                                    button.innerHTML = originalText;
                                    button.disabled = false;
                                }, 3000);
                            } else {
                                throw new Error((result && result.error) || 'Extraction failed');
                            }
                        })
                        .catch((err) => {
                            status.textContent = `Error: ${err.message}`;
                            toast(`Extraction failed: ${err.message}`, { type: 'error', title: 'DLC Unlocker' });
                            button.innerHTML = originalText;
                            button.disabled = false;
                        });
                    unsubscribe();
                    break;
                case 'error':
                    status.textContent = `Error: ${data.error}`;
                    toast(data.error || 'Download failed', { type: 'error', title: 'DLC Unlocker' });
                    button.innerHTML = originalText;
                    button.disabled = false;
                    unsubscribe();
                    break;
            }
        });

        try {
            const filename = `${key}.zip`;
            window.api.downloadStart(downloadId, url, filename);
        } catch (err) {
            status.textContent = `Error: ${err.message}`;
            button.innerHTML = originalText;
            button.disabled = false;
            unsubscribe();
        }
    }

    // Sims Card
    const simsCard = document.createElement('div');
    simsCard.className = 'app-card fixed-height dlc-card';
    grid.appendChild(simsCard);

    const simsHeader = document.createElement('div');
    simsHeader.className = 'app-header dlc-card-header';
    simsCard.appendChild(simsHeader);

    const simsIcon = document.createElement('div');
    simsIcon.className = 'dlc-icon sims-icon';
    simsIcon.innerHTML = `
    <svg class="dlc-svg sims-svg" viewBox="0 0 308 734" aria-hidden="true">
      <path d="M204 733L27.3308 366.25L380.669 366.25L204 733Z" fill="url(#paint0_linear_1_6)"/>
      <path d="M204 0L380.669 366.75H27.3308L204 0Z" fill="url(#paint1_linear_1_6)"/>
      <path d="M205.5 734L124.527 366.5L286.473 366.5L205.5 734Z" fill="url(#paint2_linear_1_6)"/>
      <path d="M205.5 0L286.473 366.75H124.527L205.5 0Z" fill="url(#paint3_linear_1_6)"/>
      <defs>
        <linearGradient id="paint0_linear_1_6" x1="34" y1="459" x2="327" y2="537" gradientUnits="userSpaceOnUse">
          <stop stop-color="#AFD23E"/><stop offset="0.518773" stop-color="#11B14B"/>
          <stop offset="0.641251" stop-color="#91C34B"/><stop offset="1" stop-color="#02591E"/>
        </linearGradient>
        <linearGradient id="paint1_linear_1_6" x1="45.5" y1="262.5" x2="387.5" y2="362" gradientUnits="userSpaceOnUse">
          <stop stop-color="#F5F8E0"/><stop offset="0.199057" stop-color="#98C868"/>
          <stop offset="0.609375" stop-color="#1AB04C"/><stop offset="1" stop-color="#99CB47"/>
        </linearGradient>
        <linearGradient id="paint2_linear_1_6" x1="117.5" y1="388" x2="290.5" y2="383.5" gradientUnits="userSpaceOnUse">
          <stop stop-color="#A3D24A"/><stop offset="1" stop-color="#51C251"/>
        </linearGradient>
        <linearGradient id="paint3_linear_1_6" x1="144.5" y1="348" x2="299" y2="348.5" gradientUnits="userSpaceOnUse">
          <stop stop-color="#DBEBB3"/><stop offset="0.375221" stop-color="#9ED167"/>
          <stop offset="1" stop-color="#61C558"/>
          <stop offset="1" stop-color="#64C559"/>
        </linearGradient>
      </defs>
    </svg>
  `;
    simsHeader.appendChild(simsIcon);

    const simsText = document.createElement('div');
    simsText.className = 'dlc-card-text';
    const simsName = document.createElement('h3');
    simsName.className = 'dlc-card-title';
    simsName.textContent = (translations?.dlc?.sims_installer) || 'Sims Installer';
    const simsDesc = document.createElement('p');
    simsDesc.className = 'dlc-card-desc';
    simsDesc.textContent = (translations?.dlc?.sims_desc) || 'Complete Sims DLC package with all expansions';
    simsText.appendChild(simsName);
    simsText.appendChild(simsDesc);
    simsHeader.appendChild(simsText);

    const simsButton = document.createElement('button');
    simsButton.className = 'button dlc-btn dlc-btn-sims';
    simsButton.innerHTML = '🎮 ' + ((translations?.dlc?.download_sims) || 'DOWNLOAD SIMS INSTALLER');
    simsCard.appendChild(simsButton);

    const simsStatus = document.createElement('pre');
    simsStatus.className = 'status-pre dlc-status';
    simsCard.appendChild(simsStatus);

    simsButton.addEventListener('click', async () => {
        simsStatus.classList.add('show');
        await downloadAndExtractDLC(
            simsButton,
            simsStatus,
            'sims-installer',
            'https://www.dropbox.com/scl/fi/5841qp2eysq0xvsxodmr1/sims_install.zip?rlkey=h843bkdkw8ymi7rqaq473ktni&st=t72b3hna&dl=1',
            (translations?.dlc?.sims_installer) || 'Sims Installer'
        );
    });

    // EA Card
    const eaCard = document.createElement('div');
    eaCard.className = 'app-card fixed-height dlc-card';
    grid.appendChild(eaCard);

    const eaHeader = document.createElement('div');
    eaHeader.className = 'app-header dlc-card-header';
    eaCard.appendChild(eaHeader);

    const eaIcon = document.createElement('div');
    eaIcon.className = 'dlc-icon ea-icon';
    eaIcon.innerHTML = `
    <svg class="dlc-svg ea-svg" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <style>.ea-a{fill:gray;}.ea-b{fill:#b2b2b2;}.ea-c{fill:none;stroke:#191919;stroke-linecap:round;stroke-linejoin:round;}</style>
      </defs>
      <polygon class="ea-a" points="16.434 5.5 10.77 14.5 4.563 14.5 5.992 11.5 9.854 11.5 11.256 9.5 2.646 9.5 1.244 11.5 3.304 11.5 0.5 16.5 12.057 16.5 16.434 9.519 18.036 12.5 16.662 12.5 15.261 14.5 19.438 14.5 20.84 16.5 23.5 16.5 16.434 5.5"/>
      <polygon class="ea-b" points="14.574 5.5 5.449 5.5 4.047 7.5 13.173 7.5 14.574 5.5"/>
      <path class="ea-c" d="M16.434,5.5l-5.664,9H4.562l1.43-3H9.854l1.4-2H2.646l-1.4,2H3.3l-2.8,5H12.057l4.377-6.981,1.6,2.981H16.662l-1.4,2h4.177l1.4,2H23.5Zm-1.86,0H5.449l-1.4,2h9.126Z"/>
    </svg>
  `;
    eaHeader.appendChild(eaIcon);

    const eaText = document.createElement('div');
    eaText.className = 'dlc-card-text';
    const eaName = document.createElement('h3');
    eaName.className = 'dlc-card-title';
    eaName.textContent = (translations?.dlc?.ea_unlocker) || 'EA Unlocker';
    const eaDesc = document.createElement('p');
    eaDesc.className = 'dlc-card-desc';
    eaDesc.textContent = (translations?.dlc?.ea_desc) || 'Unlock all EA games DLC content and features';
    eaText.appendChild(eaName);
    eaText.appendChild(eaDesc);
    eaHeader.appendChild(eaText);

    const eaButton = document.createElement('button');
    eaButton.className = 'button dlc-btn dlc-btn-ea';
    eaButton.innerHTML = '🚀 ' + ((translations?.dlc?.download_ea) || 'DOWNLOAD EA UNLOCKER');
    eaCard.appendChild(eaButton);

    const eaStatus = document.createElement('pre');
    eaStatus.className = 'status-pre dlc-status';
    eaCard.appendChild(eaStatus);

    eaButton.addEventListener('click', async () => {
        eaStatus.classList.add('show');
        await downloadAndExtractDLC(
            eaButton,
            eaStatus,
            'ea-unlocker',
            'https://www.dropbox.com/scl/fi/mbnhjivbbyyn4avjerrzw/EA_UNLOCKER.zip?rlkey=vchua3ks8whlvmgbvc2kas0mw&st=1f3zq290&dl=1',
            (translations?.dlc?.ea_unlocker) || 'EA Unlocker'
        );
    });

    // Tutorials Section
    const tutorialsSection = document.createElement('div');
    tutorialsSection.className = 'dlc-tutorials';
    container.appendChild(tutorialsSection);

    const tutorialCard = document.createElement('div');
    tutorialCard.className = 'tutorial-card-compact dlc-tutorial-card';
    tutorialsSection.appendChild(tutorialCard);

    const thumbnailContainer = document.createElement('div');
    thumbnailContainer.className = 'dlc-thumb-wrap';
    tutorialCard.appendChild(thumbnailContainer);

    const thumbnail = document.createElement('img');
    thumbnail.className = 'dlc-thumb';
    thumbnail.src = 'https://i.ytimg.com/vi/UOfQJv4tkEI/hq720.jpg?sqp=-oaymwEcCNAFEJQDSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLD8q9X7l6Kq1tV-5f5QY2W5sXwJ7g';
    thumbnail.alt = 'Tutorial';
    thumbnailContainer.appendChild(thumbnail);

    const playButton = document.createElement('div');
    playButton.className = 'dlc-play';
    playButton.innerHTML = '<span class="dlc-play-icon">▶</span>';
    thumbnailContainer.appendChild(playButton);

    const content = document.createElement('div');
    content.className = 'dlc-tutorial-content';
    const descEl = document.createElement('p');
    descEl.className = 'dlc-tutorial-desc';
    descEl.innerHTML = (translations?.dlc?.tutorial_desc) ||
        '📁 <strong>EA DLC Unlocker:</strong> General tool for unlocking DLCs in EA games<br>🎮 <strong>Sims 4 Updater:</strong> Specialized for The Sims 4 with updates & repairs';
    content.appendChild(descEl);
    tutorialCard.appendChild(content);

    tutorialCard.addEventListener('click', () => {
        if (window.api?.openExternal) window.api.openExternal('https://www.youtube.com/watch?v=UOfQJv4tkEI');
        else window.open('https://www.youtube.com/watch?v=UOfQJv4tkEI', '_blank');
    });

    return container;
}
