// Drawings for the home page's sketch scenes (D68): SVG path data on an 800 × 450 canvas. Each
// scene is a list of regions, drawn in story order (setting, person, device); inside a region
// the lines are drawn first and the pale fills fade in after them. Nothing in a drawing is
// text. The words that go with each region are in sketch-scenes.ts.
//
// The dorm, dining-hall, puppet and street drawings come from Jimmy's sketch prototype
// (Nov 24, 2026); the desk scene and the parts that the hands-on steps change were drawn for
// the site in the same style.
import type { SceneId } from './sketch-scenes.ts';

export interface Shape {
  d: string;
  /** Line weight; left out for a color fill. */
  stroke?: 'ink' | 'thin';
  /** A pale fill under the lines. */
  fill?: 'screen' | 'warm' | 'rose';
  /** Names a piece that a hands-on step changes (the puppet, a data channel, the map cell). */
  part?: string;
}

export interface Region {
  /** Time to draw the region at normal speed, in milliseconds. */
  ms: number;
  shapes: Shape[];
}

export interface Drawing {
  regions: Region[];
  /** Named points on the canvas: where data leaves for the panel, and the pivots of parts. */
  anchors: Record<string, [x: number, y: number]>;
}

export const CANVAS = { width: 800, height: 450 } as const;

export const DRAWINGS: Record<SceneId, Drawing> = {
  tracker: {
    regions: [
      // A desk with a computer and a webcam.
      {
        ms: 2600,
        shapes: [
          { d: 'M30 382 C 200 378, 600 386, 770 380', stroke: 'ink' },
          { d: 'M298 286 L618 282 M320 286 L320 382 M598 283 L600 380', stroke: 'ink' },
          { d: 'M392 153 L536 150 L537 259 L393 261 Z', fill: 'screen' },
          { d: 'M390 151 L538 148 L539 261 L391 263 Z', stroke: 'ink' },
          {
            d: 'M455 263 L452 277 M477 262 L480 277 M430 283 C 436 276, 498 275, 504 282',
            stroke: 'ink',
          },
          { d: 'M417 126 L442 125 L443 141 L418 142 Z M430 142 L430 150', stroke: 'ink' },
          { d: 'M417 130 L407 126 L408 142 L418 138', stroke: 'thin' },
          { d: 'M312 285 L324 271 L382 269 L374 284 Z M319 278 L378 276', stroke: 'thin' },
          {
            d: 'M118 60 C 139 59, 157 77, 156 99 C 156 119, 138 137, 117 136 C 97 136, 80 118, 80 98 C 80 77, 97 60, 118 60 Z',
            stroke: 'ink',
          },
          { d: 'M118 98 L102 89 M118 98 L141 85', stroke: 'ink' },
          { d: 'M118 66 L118 75 M150 98 L141 98 M118 130 L118 121 M86 98 L95 98', stroke: 'thin' },
        ],
      },
      // A learner reads on the web.
      {
        ms: 2600,
        shapes: [
          {
            d: 'M266 317 L192 319 M192 319 L187 233 M258 318 L260 381 M197 319 L193 382',
            stroke: 'ink',
          },
          {
            d: 'M228 166 C 242 166, 252 177, 252 190 C 252 204, 241 214, 227 214 C 214 214, 204 203, 204 190 C 204 176, 214 166, 228 166 Z',
            stroke: 'ink',
          },
          {
            d: 'M230 191 C 231 194, 235 194, 236 191 M241 190 C 242 193, 246 193, 247 190',
            stroke: 'thin',
          },
          { d: 'M226 214 C 223 250, 221 290, 224 316', stroke: 'ink' },
          { d: 'M224 316 C 250 318, 270 317, 282 320 L280 380 L298 382', stroke: 'ink' },
          { d: 'M225 232 C 238 245, 250 256, 257 262 L320 272', stroke: 'ink' },
        ],
      },
      // A browser extension logs clicks, scrolls and searches, and reads gaze from the webcam.
      // In the lens: the page, then the pointer (a click), the up-and-down arrow (scrolling),
      // and last the webcam's sight line with the ring around the line being read (gaze).
      {
        ms: 3000,
        shapes: [
          { d: 'M603 103 L712 101 L713 171 L604 173 Z', fill: 'screen' },
          { d: 'M543 165 C 555 161, 567 155, 577 147', stroke: 'thin' },
          {
            d: 'M664 40 C 712 40, 750 78, 750 126 C 750 174, 711 212, 664 212 C 616 212, 578 173, 578 126 C 578 78, 617 40, 664 40 Z',
            stroke: 'ink',
          },
          { d: 'M600 80 L712 78 L714 172 L602 174 Z M601 102 L713 100', stroke: 'thin' },
          {
            d: 'M614 84 C 617 84, 619 86, 619 88 C 619 91, 617 93, 614 93 C 611 93, 609 91, 609 88 C 609 86, 611 84, 614 84 Z M617 92 L623 97 M631 91 L692 89',
            stroke: 'thin',
          },
          {
            d: 'M616 115 L666 114 M618 131 L650 130 M616 147 L668 146 M616 161 L648 160',
            stroke: 'thin',
          },
          { d: 'M676 109 L704 108 L705 133 L677 134 Z', stroke: 'thin' },
          { d: 'M687 138 L688 160 L701 153 Z M694 157 L698 166', stroke: 'ink' },
          {
            d: 'M731 102 L732 150 M725 110 L731 101 L737 110 M726 142 L732 151 L738 142',
            stroke: 'ink',
          },
          { d: 'M402 135 C 356 147, 304 168, 258 187', stroke: 'thin' },
          {
            d: 'M634 123 C 649 122, 661 126, 660 131 C 660 136, 648 140, 633 139 C 619 139, 608 135, 608 131 C 608 126, 620 123, 634 123 Z',
            stroke: 'ink',
          },
        ],
      },
      // Once a minute, a pop-up asks the learner about that minute.
      {
        ms: 1800,
        shapes: [
          { d: 'M431 181 L501 179 L502 229 L432 231 Z', fill: 'warm' },
          { d: 'M430 180 L502 178 L503 230 L431 232 Z', stroke: 'ink' },
          { d: 'M439 192 L488 191', stroke: 'thin' },
          {
            d: 'M439 204 L462 204 L462 220 L439 220 Z M471 204 L494 203 L494 219 L471 220 Z',
            stroke: 'thin',
          },
        ],
      },
    ],
    anchors: { lens: [664, 126] },
  },
  dorm: {
    regions: [
      // A dorm room in the evening.
      {
        ms: 2600,
        shapes: [
          { d: 'M30 382 C 200 378, 600 386, 770 380', stroke: 'ink' },
          { d: 'M80 70 L250 66 L252 200 L82 204 Z', stroke: 'ink' },
          { d: 'M166 68 L167 202 M81 136 L251 133', stroke: 'thin' },
          {
            d: 'M70 60 C 90 120, 60 170, 78 214 M262 58 C 245 120, 270 170, 258 212',
            stroke: 'ink',
          },
          { d: 'M40 300 L300 296 L302 352 L42 356 Z', stroke: 'ink' },
          { d: 'M52 282 C 60 268, 110 266, 118 280 C 120 296, 60 298, 52 282 Z', stroke: 'ink' },
          { d: 'M140 297 C 180 320, 240 318, 300 300', stroke: 'thin' },
          { d: 'M48 356 L48 382 M296 352 L296 380', stroke: 'ink' },
          { d: 'M420 280 L760 276 M440 280 L440 382 M740 277 L742 380', stroke: 'ink' },
          { d: 'M511 118 L513 86 L524 86 L523 118 Z', fill: 'rose' },
          { d: 'M470 120 L700 118', stroke: 'ink' },
          {
            d: 'M490 118 L492 80 L506 80 L505 118 M511 118 L513 86 L524 86 L523 118 M530 118 L540 84 L552 88 L542 119',
            stroke: 'thin',
          },
          {
            d: 'M650 118 L655 96 L685 96 L690 118 M670 96 C 660 72, 644 66, 638 60 M670 96 C 680 72, 698 68, 706 62 M670 96 C 670 78, 672 66, 674 56',
            stroke: 'thin',
          },
        ],
      },
      // A student sits down at the desk.
      {
        ms: 2600,
        shapes: [
          {
            d: 'M600 318 L680 318 M680 318 L684 232 M606 318 L604 382 M676 318 L680 382',
            stroke: 'ink',
          },
          {
            d: 'M640 166 C 655 166, 664 178, 664 190 C 664 204, 652 214, 640 214 C 626 214, 616 203, 616 190 C 616 176, 626 166, 640 166 Z',
            stroke: 'ink',
          },
          { d: 'M618 184 C 624 162, 652 158, 664 182', stroke: 'thin' },
          { d: 'M642 214 C 646 250, 648 290, 646 316', stroke: 'ink' },
          { d: 'M646 316 C 620 318, 600 318, 588 320 L590 380 L572 382', stroke: 'ink' },
          { d: 'M643 232 C 630 245, 618 256, 612 262 L566 272', stroke: 'ink' },
        ],
      },
      // Their browsing history holds traces of what they care about.
      {
        ms: 3000,
        shapes: [
          { d: 'M431 276 L433 251 L451 251 L449 276 Z', fill: 'warm' },
          { d: 'M320 110 L442 108 L443 175 L321 177 Z', fill: 'screen' },
          { d: 'M470 276 L572 276 M474 270 L452 200 L462 198 L486 270', stroke: 'ink' },
          {
            d: 'M430 276 L432 250 L452 250 L450 276 Z M432 256 C 420 256, 420 270, 432 268',
            stroke: 'ink',
          },
          { d: 'M452 196 L430 190', stroke: 'thin' },
          {
            d: 'M380 50 C 425 50, 462 86, 462 132 C 462 178, 425 214, 380 214 C 335 214, 298 178, 298 132 C 298 86, 335 50, 380 50 Z',
            stroke: 'ink',
          },
          { d: 'M318 92 L442 90 L444 176 L320 178 Z M320 108 L443 106', stroke: 'thin' },
          {
            d: 'M326 106 L330 96 L356 96 L360 106 M362 106 L366 96 L392 96 L396 106 M398 106 L402 96 L428 96 L432 106',
            stroke: 'thin',
          },
          {
            d: 'M332 124 L396 123 M332 138 L386 137 M332 152 L392 151 M332 164 L372 163 M404 126 L432 126 L432 160 L404 160 Z',
            stroke: 'thin',
          },
        ],
      },
    ],
    anchors: { lens: [380, 132] },
  },
  dining: {
    regions: [
      // Lunch in the dining hall.
      {
        ms: 2600,
        shapes: [
          { d: 'M30 382 C 200 378, 600 386, 770 380', stroke: 'ink' },
          {
            d: 'M60 210 L60 112 C 60 72, 140 72, 140 112 L140 210 Z M200 210 L200 112 C 200 72, 280 72, 280 112 L280 210 Z',
            stroke: 'thin',
          },
          {
            d: 'M100 76 L100 210 M60 150 L140 150 M240 76 L240 210 M200 150 L280 150',
            stroke: 'thin',
          },
          {
            d: 'M370 0 L370 52 M350 68 L370 52 L390 68 Z M660 0 L660 40 M640 56 L660 40 L680 56 Z',
            stroke: 'thin',
          },
          {
            d: 'M680 230 L770 230 M680 230 L680 300 M690 222 L740 222 M692 214 L738 214',
            stroke: 'ink',
          },
          {
            d: 'M720 176 C 727 176, 732 181, 732 188 C 732 195, 727 200, 720 200 C 713 200, 708 195, 708 188 C 708 181, 713 176, 720 176 Z M720 200 L720 246 M720 212 L708 228 M720 212 L734 226 M720 246 L712 276 M720 246 L728 276',
            stroke: 'thin',
          },
          {
            d: 'M120 300 L640 296 M118 312 L642 308 M150 312 L150 382 M610 308 L612 382',
            stroke: 'ink',
          },
        ],
      },
      // The same student, eating between classes.
      {
        ms: 2600,
        shapes: [
          {
            d: 'M380 170 C 395 170, 406 182, 406 196 C 406 211, 395 222, 380 222 C 365 222, 354 211, 354 196 C 354 182, 365 170, 380 170 Z',
            stroke: 'ink',
          },
          { d: 'M355 190 C 358 168, 400 160, 406 190', stroke: 'thin' },
          {
            d: 'M368 200 C 370 204, 374 204, 376 200 M386 200 C 388 204, 392 204, 394 200',
            stroke: 'thin',
          },
          {
            d: 'M380 222 L380 234 M340 254 C 350 234, 410 234, 420 254 M340 254 L336 298 M420 254 L424 296',
            stroke: 'ink',
          },
          { d: 'M342 260 C 322 272, 318 288, 328 294', stroke: 'ink' },
          { d: 'M418 258 C 440 264, 452 252, 455 238', stroke: 'ink' },
        ],
      },
      // Between bites, they scroll and post on social media.
      {
        ms: 3000,
        shapes: [
          { d: 'M449 208 L474 205 L477 248 L452 251 Z', fill: 'screen' },
          { d: 'M553 73 L589 73 L589 103 L553 103 Z', fill: 'screen' },
          { d: 'M296 300 L466 298 M310 290 C 312 268, 360 268, 362 290 Z', stroke: 'ink' },
          {
            d: 'M326 262 C 320 252, 334 246, 328 236 M344 262 C 338 252, 352 246, 346 236',
            stroke: 'thin',
          },
          { d: 'M374 292 L330 262 M380 290 L338 258', stroke: 'thin' },
          { d: 'M446 204 L476 200 L480 250 L450 254 Z', stroke: 'ink' },
          { d: 'M480 214 L514 186', stroke: 'thin' },
          {
            d: 'M590 38 C 634 38, 670 74, 670 118 C 670 162, 634 198, 590 198 C 546 198, 510 162, 510 118 C 510 74, 546 38, 590 38 Z',
            stroke: 'ink',
          },
          {
            d: 'M545 66 L635 64 L636 112 L546 114 Z M552 72 L590 72 L590 104 L552 104 Z M598 80 L628 80 M598 92 L620 92',
            stroke: 'thin',
          },
          {
            d: 'M546 124 L636 122 L637 170 L547 172 Z M562 150 C 554 140, 566 134, 570 145 C 574 134, 586 140, 578 150 L570 158 Z M594 140 L628 139 M594 152 L620 151',
            stroke: 'thin',
          },
        ],
      },
    ],
    anchors: { lens: [590, 118] },
  },
  puppet: {
    regions: [
      // A classroom table with a camera and a laptop.
      {
        ms: 2600,
        shapes: [
          { d: 'M30 382 C 200 378, 600 386, 770 380', stroke: 'ink' },
          { d: 'M40 60 L260 56 L262 170 L42 174 Z', stroke: 'thin' },
          {
            d: 'M70 140 C 90 100, 120 100, 130 130 M150 90 L230 88 M150 110 L210 109 M150 130 L222 128',
            stroke: 'thin',
          },
          { d: 'M472 222 L568 220 L569 288 L473 290 Z', fill: 'screen' },
          { d: 'M180 300 L620 296 M200 300 L200 382 M600 297 L602 380', stroke: 'ink' },
          {
            d: 'M228 248 L272 246 L273 272 L229 274 Z M250 274 L250 298 M236 298 L264 297',
            stroke: 'ink',
          },
          { d: 'M272 252 C 278 256, 278 264, 272 268', stroke: 'thin' },
          { d: 'M470 220 L570 218 L571 290 L471 292 Z M458 299 L584 297', stroke: 'ink' },
        ],
      },
      // A storyteller moves a puppet in front of the camera. The puppet is part 'puppet'; its beak
      // points right, so mirroring the part about anchors.puppet turns it to face left.
      {
        ms: 2600,
        shapes: [
          {
            d: 'M360 178 C 371 178, 379 187, 379 198 C 379 209, 371 218, 360 218 C 349 218, 341 209, 341 198 C 341 187, 349 178, 360 178 Z',
            stroke: 'ink',
          },
          {
            d: 'M352 200 C 353 203, 356 203, 357 200 M364 200 C 365 203, 368 203, 369 200',
            stroke: 'thin',
          },
          { d: 'M360 218 L360 296 M360 236 C 340 252, 334 270, 340 292', stroke: 'ink' },
          { d: 'M360 236 C 380 230, 394 218, 400 200', stroke: 'ink' },
          { d: 'M396 176 L408 176 L408 186 L396 186 Z', fill: 'warm', part: 'puppet' },
          {
            d: 'M402 148 C 409 148, 414 153, 414 160 C 414 166, 409 171, 402 171 C 395 171, 390 166, 390 160 C 390 153, 395 148, 402 148 Z',
            stroke: 'ink',
            part: 'puppet',
          },
          {
            d: 'M394 171 C 388 182, 390 192, 400 200 C 412 194, 416 182, 410 171',
            stroke: 'ink',
            part: 'puppet',
          },
          { d: 'M390 158 L382 150 M414 158 L422 150', stroke: 'thin', part: 'puppet' },
          { d: 'M414 160 L430 165 L410 168', stroke: 'ink', part: 'puppet' },
        ],
      },
      // The camera tracks where the puppet is. A motion sensor on it tracks how it turns.
      // The character in the lens is part 'avatar' (pivot: anchors.avatar) and has the same beak.
      // The chip outline belongs to 'puppet'; the radio waves have no part and never flip.
      {
        ms: 3000,
        shapes: [
          { d: 'M604 112 L626 112 L626 130 L604 130 Z', fill: 'warm', part: 'avatar' },
          { d: 'M276 252 C 300 190, 340 160, 386 158', stroke: 'thin' },
          { d: 'M396 176 L408 176 L408 186 L396 186 Z', stroke: 'thin', part: 'puppet' },
          {
            d: 'M422 196 C 428 192, 428 186, 424 182 M428 202 C 438 194, 438 182, 430 174',
            stroke: 'thin',
          },
          {
            d: 'M640 40 C 684 40, 720 76, 720 120 C 720 164, 684 200, 640 200 C 596 200, 560 164, 560 120 C 560 76, 596 40, 640 40 Z',
            stroke: 'ink',
          },
          { d: 'M572 226 C 590 214, 600 206, 606 196', stroke: 'thin' },
          {
            d: 'M615 66 C 629 66, 640 77, 640 90 C 640 103, 629 112, 615 112 C 601 112, 590 103, 590 90 C 590 77, 601 66, 615 66 Z',
            stroke: 'ink',
            part: 'avatar',
          },
          {
            d: 'M598 112 C 586 132, 590 150, 612 162 C 636 150, 640 132, 630 112',
            stroke: 'ink',
            part: 'avatar',
          },
          {
            d: 'M590 88 L576 74 M640 88 L654 74 M600 92 C 602 96, 606 96, 608 92 M622 92 C 624 96, 628 96, 630 92',
            stroke: 'thin',
            part: 'avatar',
          },
          { d: 'M640 94 L659 101 L634 105', stroke: 'ink', part: 'avatar' },
          { d: 'M664 150 C 676 140, 690 140, 700 152 M672 160 L700 160', stroke: 'thin' },
        ],
      },
    ],
    anchors: { camera: [272, 260], chip: [402, 181], puppet: [402, 174], avatar: [615, 114] },
  },
  city: {
    regions: [
      // A street during a hurricane flood.
      {
        ms: 2600,
        shapes: [
          {
            d: 'M84 216 L108 216 L108 240 L84 240 Z M132 216 L156 216 L156 240 L132 240 Z M246 230 L270 230 L270 252 L246 252 Z',
            fill: 'screen',
          },
          { d: 'M60 190 L180 188 L182 300 L62 302 Z M50 192 L120 140 L192 190', stroke: 'ink' },
          {
            d: 'M84 216 L108 216 L108 240 L84 240 Z M132 216 L156 216 L156 240 L132 240 Z M110 300 L110 264 L130 264 L130 300',
            stroke: 'thin',
          },
          { d: 'M220 210 L320 208 L322 300 L222 302 Z M210 212 L270 166 L332 210', stroke: 'ink' },
          { d: 'M246 230 L270 230 L270 252 L246 252 Z', stroke: 'thin' },
          { d: 'M30 304 C 250 300, 560 306, 770 300', stroke: 'ink' },
          {
            d: 'M30 326 C 60 318, 90 334, 120 326 C 150 318, 180 334, 210 326 C 240 318, 270 334, 300 326 C 330 318, 360 334, 390 326 C 420 318, 450 334, 480 326 C 510 318, 540 334, 570 326 C 600 318, 630 334, 660 326 C 690 318, 720 334, 770 326',
            stroke: 'ink',
          },
          {
            d: 'M60 356 C 90 348, 120 364, 150 356 C 180 348, 210 364, 240 356 M330 360 C 360 352, 390 368, 420 360 C 450 352, 480 368, 510 360 M600 356 C 630 348, 660 364, 700 356',
            stroke: 'thin',
          },
          {
            d: 'M60 40 L50 62 M110 30 L100 52 M170 46 L160 68 M230 30 L220 52 M300 44 L290 66 M360 28 L350 50 M420 46 L410 68 M480 30 L470 52',
            stroke: 'thin',
          },
        ],
      },
      // A resident steps outside with a phone.
      {
        ms: 2600,
        shapes: [
          {
            d: 'M470 176 C 481 176, 490 185, 490 196 C 490 207, 481 216, 470 216 C 459 216, 450 207, 450 196 C 450 185, 459 176, 470 176 Z',
            stroke: 'ink',
          },
          {
            d: 'M462 198 C 463 201, 466 201, 467 198 M474 198 C 475 201, 478 201, 479 198',
            stroke: 'thin',
          },
          { d: 'M470 216 L472 280 M472 280 L462 320 M472 280 L484 320', stroke: 'ink' },
          { d: 'M471 232 C 490 236, 498 220, 500 200 L500 150', stroke: 'ink' },
          {
            d: 'M440 156 C 450 120, 550 120, 560 156 C 545 150, 530 150, 520 156 C 510 150, 490 150, 480 156 C 470 150, 455 150, 440 156 Z',
            stroke: 'ink',
          },
          { d: 'M471 232 C 456 240, 448 248, 446 256', stroke: 'ink' },
          { d: 'M436 250 L452 248 L454 270 L438 272 Z', stroke: 'ink' },
        ],
      },
      // An official sensor, citizen reports and social posts all point at cells of one map.
      // Channels: 'sensor' (radio waves and link), 'citizen' (the phone's link), 'social' (the
      // post card and its link). The cell: 'cell' is the solid fill and 'cell-tick' the tick
      // drawn on it when all three channels agree; 'cell-hatch' is the hatching shown in their
      // place when only two agree.
      {
        ms: 3000,
        shapes: [
          { d: 'M630 86 L660 86 L660 116 L630 116 Z', fill: 'warm', part: 'cell' },
          { d: 'M378 336 L380 214 M368 194 L392 194 L392 214 L368 214 Z', stroke: 'ink' },
          {
            d: 'M372 240 L386 240 M372 262 L386 262 M372 284 L386 284 M372 306 L386 306',
            stroke: 'thin',
          },
          {
            d: 'M396 192 C 402 188, 402 180, 398 176 M402 198 C 412 190, 412 176, 404 168',
            stroke: 'thin',
            part: 'sensor',
          },
          {
            d: 'M630 34 C 674 34, 710 70, 710 114 C 710 158, 674 194, 630 194 C 586 194, 550 158, 550 114 C 550 70, 586 34, 630 34 Z',
            stroke: 'ink',
          },
          {
            d: 'M570 56 L690 54 L692 146 L572 148 Z M570 86 L691 85 M571 116 L692 115 M600 55 L602 147 M630 55 L631 147 M660 54 L661 146',
            stroke: 'thin',
          },
          {
            d: 'M635 99 L645 90 M636 111 L655 91 M646 112 L656 102',
            stroke: 'thin',
            part: 'cell-hatch',
          },
          { d: 'M636 101 L643 109 L655 92', stroke: 'ink', part: 'cell-tick' },
          { d: 'M410 160 C 420 112, 480 84, 546 94', stroke: 'thin', part: 'sensor' },
          { d: 'M456 248 C 500 230, 530 210, 556 180', stroke: 'thin', part: 'citizen' },
          { d: 'M708 219 L726 218 L727 243 L709 244 Z', fill: 'screen', part: 'social' },
          { d: 'M700 211 L760 209 L761 251 L701 253 Z', stroke: 'ink', part: 'social' },
          {
            d: 'M707 218 L727 217 L728 244 L708 245 Z M735 231 L753 230',
            stroke: 'thin',
            part: 'social',
          },
          { d: 'M714 207 C 710 198, 703 186, 692 175', stroke: 'thin', part: 'social' },
        ],
      },
    ],
    anchors: { sensor: [380, 204], phone: [446, 260], post: [730, 231] },
  },
};
