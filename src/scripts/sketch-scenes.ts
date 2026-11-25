// Behavior of the sketch scenes (D68, D73, D76), on the home page.
// The page already holds every scene finished (see SketchScenes.astro); this script shows one
// scene at a time, draws it stroke by stroke, and runs each scene's hands-on step. All words
// stay in the HTML: the script only moves attributes and classes, so it never needs the copy.
//
// Motion: a scene draws once when it first comes into view or when the visitor picks it, and
// "Show all" stops it at any point. Nothing loops. With prefers-reduced-motion the drawings
// are shown finished and only the hands-on steps remain.

const STOP = Symbol('stop');
const SVG_NS = 'http://www.w3.org/2000/svg';

type Kind = 'answer' | 'judge' | 'turn' | 'toggle' | 'choose';

function init(root: HTMLElement): void {
  // The page has already fallen back to its finished scenes (the script came very late). Taking
  // over now would fold all but one of them away under a visitor who may be reading one.
  if (root.hasAttribute('data-failed')) return;

  const scenes = [...root.querySelectorAll<HTMLElement>('[data-scene]')];
  const buttons = [...root.querySelectorAll<HTMLButtonElement>('[data-scene-button]')];
  const live = root.querySelector<HTMLElement>('[data-live]');
  const first = scenes[0];
  if (!first || !live) return;

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  /** One column: the panel is below the drawing, not beside it (same width as the stylesheet). */
  const narrow = window.matchMedia('(max-width: 56rem)');
  /** Scenes the visitor has opened: the first visit draws, later visits keep their state. */
  const seen = new WeakSet<HTMLElement>();
  let current = first;
  /** Changes whenever a drawing is started or stopped; a running one checks it and stops. */
  let token = 0;
  /** The first scene waits, undrawn, until its drawing scrolls into view. */
  let armed = false;

  const speed = (): number => Number(root.dataset.speed) || 1;
  const kind = (scene: HTMLElement): Kind => scene.dataset.kind as Kind;
  const all = <T extends Element>(scene: Element, selector: string): T[] => [
    ...scene.querySelectorAll<T>(selector),
  ];
  const rows = (scene: HTMLElement): HTMLElement[] => all<HTMLElement>(scene, '[data-entry]');
  const sceneOf = (id: string): HTMLElement | undefined =>
    scenes.find((scene) => scene.dataset.scene === id);

  // ------------------------------------------------------------------ announcements

  let pending = 0;
  let fading = 0;

  /** Nothing waiting to be read out, and nothing left in the reading order. */
  function hush(): void {
    cancelAnimationFrame(pending);
    window.clearTimeout(fading);
    live!.textContent = '';
  }

  /** Screen readers hear a line only when the visitor asked for something. */
  function say(text: string): void {
    hush();
    pending = requestAnimationFrame(() => {
      live!.textContent = text.replace(/\s+/g, ' ').trim();
      // Long enough to be spoken; then it leaves, so nobody meets it again while reading on.
      fading = window.setTimeout(() => {
        live!.textContent = '';
      }, 15_000);
    });
  }

  const visibleText = (scene: HTMLElement, selector: string): string =>
    all<HTMLElement>(scene, selector)
      .filter((el) => getComputedStyle(el).visibility !== 'hidden' && el.offsetParent !== null)
      .map((el) => el.textContent ?? '')
      .join(' ');

  /** What a step did; the first time, also the results it released. */
  function sayStep(scene: HTMLElement, selector: string, first: boolean): void {
    say(
      first
        ? `${visibleText(scene, selector)} ${visibleText(scene, '.sk__results .sk__result')}`
        : visibleText(scene, selector),
    );
  }

  // ------------------------------------------------------------------ drawing

  function sleep(ms: number, t: number): Promise<void> {
    return new Promise((resolve, reject) => {
      window.setTimeout(() => (t === token ? resolve() : reject(STOP)), ms / speed());
    });
  }

  const frame = (): Promise<number> => new Promise((resolve) => requestAnimationFrame(resolve));
  const ease = (x: number): number => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);

  /** The parts of options the visitor has not picked: out of the picture, so never drawn. */
  const unpicked = (el: Element): boolean => el.matches('[data-part^="pick-"]:not(.is-chosen)');
  const inks = (scope: Element): SVGPathElement[] =>
    all<SVGPathElement>(scope, '.sk__ink').filter(
      // Lines that the current state hides (the hatch of the map cell) are not drawn.
      (path) => !unpicked(path) && getComputedStyle(path).visibility !== 'hidden',
    );
  const fills = (scope: Element): SVGPathElement[] => all<SVGPathElement>(scope, '.sk__fill');

  /**
   * One <path> per stroke. SVG restarts a dash pattern on every sub-path, so a shape made of
   * several strokes would show them all growing at once while the pencil follows only one.
   * The page ships the shapes whole; they are split here, once, before the first drawing.
   */
  function splitStrokes(svg: SVGSVGElement): void {
    if (svg.hasAttribute('data-split')) return;
    svg.setAttribute('data-split', '');
    for (const path of all<SVGPathElement>(svg, '.sk__ink')) {
      const strokes = (path.getAttribute('d') ?? '').match(/M[^M]+/g) ?? [];
      if (strokes.length < 2) continue;
      path.replaceWith(
        ...strokes.map((d) => {
          const stroke = path.cloneNode(false) as SVGPathElement;
          stroke.setAttribute('d', d.trim());
          return stroke;
        }),
      );
    }
  }

  function hideDrawing(svg: SVGSVGElement): void {
    splitStrokes(svg);
    for (const path of all<SVGPathElement>(svg, '.sk__ink')) {
      const length = path.getTotalLength();
      path.style.strokeDasharray = `${length} ${length}`;
      path.style.strokeDashoffset = String(length);
    }
    for (const fill of fills(svg)) fill.style.opacity = '0';
  }

  /** No pencil, no wire and no cards left on the paper. */
  function clearOverlay(svg: SVGSVGElement): void {
    svg.querySelector('[data-pen]')?.removeAttribute('data-on');
    svg.querySelector('[data-flow]')?.replaceChildren();
  }

  function showDrawing(svg: SVGSVGElement): void {
    for (const path of all<SVGPathElement>(svg, '.sk__ink')) {
      path.style.strokeDasharray = '';
      path.style.strokeDashoffset = '';
    }
    for (const fill of fills(svg)) fill.style.opacity = '';
    clearOverlay(svg);
  }

  function placePen(svg: SVGSVGElement, point: DOMPoint): void {
    const pen = svg.querySelector('[data-pen]');
    pen?.setAttribute('data-on', '');
    pen?.setAttribute('transform', `translate(${point.x} ${point.y})`);
  }

  async function drawPath(svg: SVGSVGElement, path: SVGPathElement, ms: number, t: number) {
    const length = path.getTotalLength();
    const duration = ms / speed();
    const start = performance.now();
    for (;;) {
      if (t !== token) throw STOP;
      const k = Math.min(1, (performance.now() - start) / duration);
      path.style.strokeDashoffset = String(length * (1 - k));
      placePen(svg, path.getPointAtLength(length * k));
      if (k >= 1) break;
      await frame();
    }
  }

  async function fade(elements: SVGElement[], ms: number, t: number) {
    const duration = ms / speed();
    const start = performance.now();
    for (;;) {
      if (t !== token) throw STOP;
      const k = Math.min(1, (performance.now() - start) / duration);
      for (const el of elements) el.style.opacity = String(k);
      if (k >= 1) break;
      await frame();
    }
  }

  /** Lines first, then color: two thirds of the region's time for the lines. */
  async function drawRegion(svg: SVGSVGElement, region: SVGGElement, t: number) {
    const ms = Number(region.dataset.ms) || 2600;
    const paths = inks(region);
    const total = paths.reduce((sum, path) => sum + path.getTotalLength(), 0) || 1;
    for (const path of paths) {
      await drawPath(svg, path, Math.max(40, ((ms * 2) / 3) * (path.getTotalLength() / total)), t);
    }
    svg.querySelector('[data-pen]')?.removeAttribute('data-on');
    const colors = fills(region).filter((fill) => !unpicked(fill));
    if (colors.length) await fade(colors, ms / 3, t);
  }

  /** Small cards travel from a point of the drawing toward the panel; one may be stopped. */
  async function flyCards(svg: SVGSVGElement, step: HTMLElement, t: number) {
    const flow = svg.querySelector('[data-flow]');
    const anchors = JSON.parse(svg.dataset.anchors ?? '{}') as Record<string, [number, number]>;
    const from = anchors[step.dataset.fly ?? ''];
    if (!flow || !from) return;
    const held = step.dataset.filtered !== undefined;
    const [x, y] = from;
    // Toward the panel: down when it is below the drawing, to the right when it is beside it.
    // A source close to the right edge gets a low arch, or the wire would fold back on itself.
    const edge = 792;
    const d = narrow.matches
      ? `M${x} ${y} C ${Math.min(x + 90, 760)} ${y + 70}, 640 330, 690 442`
      : x > 680
        ? `M${x} ${y} C ${x + (edge - x) / 3} ${y - 60}, ${x + (2 * (edge - x)) / 3} ${y - 60}, ${edge} 228`
        : `M${x} ${y} C ${Math.min(x + 140, 770)} ${Math.max(y - 80, 20)}, 740 110, ${edge} 228`;
    flow.replaceChildren();
    const wire = document.createElementNS(SVG_NS, 'path');
    wire.setAttribute('d', d);
    wire.setAttribute('class', 'sk__wire');
    flow.append(wire);
    const length = wire.getTotalLength();
    wire.style.strokeDasharray = `${length} ${length}`;
    wire.style.strokeDashoffset = String(length);
    await drawPath(svg, wire, 700, t);
    svg.querySelector('[data-pen]')?.removeAttribute('data-on');

    const count = held ? 5 : 3;
    const cards: SVGGElement[] = [];
    for (let i = 0; i < count; i++) {
      const card = document.createElementNS(SVG_NS, 'g');
      card.setAttribute('class', 'sk__card');
      const box = document.createElementNS(SVG_NS, 'rect');
      for (const [name, value] of Object.entries({ x: -14, y: -10, width: 28, height: 20, rx: 2 }))
        box.setAttribute(name, String(value));
      const lines = document.createElementNS(SVG_NS, 'path');
      lines.setAttribute('d', 'M-8 -3 L8 -3 M-8 3 L4 3');
      card.append(box, lines);
      if (held && i === 2) {
        const cross = document.createElementNS(SVG_NS, 'path');
        cross.setAttribute('class', 'sk__card-x');
        cross.setAttribute('d', 'M-16 -12 L16 12 M16 -12 L-16 12');
        card.append(cross);
      }
      flow.append(card);
      cards.push(card);
    }
    const duration = (held ? 1700 : 1200) / speed();
    const lag = 160 / speed();
    const start = performance.now();
    for (;;) {
      if (t !== token) throw STOP;
      const elapsed = performance.now() - start;
      let done = true;
      cards.forEach((card, i) => {
        // The sample that is held back stops a little way along and stays there.
        const stopped = held && i === 2;
        let k = Math.max(0, Math.min(1, (elapsed - i * lag) / (duration - lag * (count - 1))));
        if (stopped) k = Math.min(k, 0.28);
        else if (k < 1) done = false;
        const point = wire.getPointAtLength(length * ease(k));
        card.setAttribute('transform', `translate(${point.x} ${point.y})`);
        card.style.opacity = stopped || k < 1 ? '1' : '0';
      });
      if (done && elapsed > duration) break;
      await frame();
    }
  }

  // ------------------------------------------------------------------ scene states

  const svgOf = (scene: HTMLElement): SVGSVGElement | null =>
    scene.querySelector<SVGSVGElement>('[data-svg]');

  /** Blank paper and an empty panel, ready to be drawn. */
  function clear(scene: HTMLElement): void {
    scene.dataset.state = 'playing';
    scene.setAttribute('data-empty', '');
    for (const el of all<HTMLElement>(scene, '[data-step], [data-entry]')) {
      el.removeAttribute('data-on');
      el.classList.remove('is-current');
    }
    const svg = svgOf(scene);
    if (!svg) return;
    // The flood scene's map cell starts empty and fills as the channels report (see play()).
    if (kind(scene) === 'toggle') svg.setAttribute('data-count', '0');
    hideDrawing(svg);
    clearOverlay(svg);
  }

  /** The finished drawing, every caption and every row; the step is the visitor's to do. */
  function settle(scene: HTMLElement): void {
    scene.dataset.state = scene.hasAttribute('data-task-done') ? 'done' : 'ready';
    scene.removeAttribute('data-empty');
    for (const el of all<HTMLElement>(scene, '[data-step], [data-entry]')) {
      el.setAttribute('data-on', '');
      el.classList.remove('is-current');
    }
    const svg = svgOf(scene);
    if (svg) showDrawing(svg);
    // Back from the count the drawing had reached to what the switches say.
    if (kind(scene) === 'toggle') applyChannels(scene);
  }

  function finish(scene: HTMLElement): void {
    token++;
    armed = false;
    hush();
    settle(scene);
  }

  async function play(scene: HTMLElement, announce: boolean): Promise<void> {
    const t = ++token;
    armed = false;
    const svg = svgOf(scene);
    if (!svg) return settle(scene);
    clear(scene);
    const regions = all<SVGGElement>(svg, '[data-region]');
    const entries = rows(scene);
    try {
      for (const step of all<HTMLElement>(scene, '[data-step]')) {
        for (const other of all<HTMLElement>(scene, '.is-current'))
          other.classList.remove('is-current');
        step.setAttribute('data-on', '');
        step.classList.add('is-current');
        const region = step.dataset.draw === undefined ? undefined : regions[+step.dataset.draw];
        if (region) await drawRegion(svg, region, t);
        if (step.dataset.fly) await flyCards(svg, step, t);
        for (const index of (step.dataset.reveal ?? '').split(',').filter(Boolean)) {
          scene.removeAttribute('data-empty');
          entries[+index]?.setAttribute('data-on', '');
          if (kind(scene) === 'toggle') showChannelCount(scene, svg);
          await sleep(380, t);
        }
        await sleep(450, t);
      }
      settle(scene);
      // The captions are all in the page to be read at any moment, so they are not read out one
      // by one. What is said, to whoever asked for the scene, is that the step is now open.
      if (announce) say(visibleText(scene, '.sk__prompt'));
    } catch (error) {
      if (error !== STOP) throw error;
    }
  }

  /**
   * While the flood scene draws, its map cell follows the channels that have reported so far:
   * empty with one, hatched with two (the verification quest), filled and ticked with three.
   */
  function showChannelCount(scene: HTMLElement, svg: SVGSVGElement): void {
    svg.setAttribute('data-count', String(all(scene, '[data-entry][data-on]').length));
    // The cell's marks were hidden when their region was drawn, so they were not drawn then.
    for (const mark of all<SVGPathElement>(svg, '[data-part^="cell"]')) {
      mark.style.strokeDasharray = '';
      mark.style.strokeDashoffset = '';
      mark.style.opacity = '';
    }
  }

  // ------------------------------------------------------------------ hands-on steps

  /** A pick: the drawing's parts and the outcome line of the option picked, and no other. */
  function applyChoice(scene: HTMLElement): void {
    const choice = scene.dataset.choice ?? 'none';
    for (const part of all(scene, '[data-part^="pick-"]'))
      part.classList.toggle('is-chosen', part.getAttribute('data-part') === `pick-${choice}`);
    for (const line of all<HTMLElement>(scene, '.sk__status [data-when]'))
      line.classList.toggle('is-chosen', line.dataset.when === choice);
  }

  /** Back to before the visitor (or the sample) answered. */
  function resetTask(scene: HTMLElement): void {
    scene.removeAttribute('data-task-done');
    scene.removeAttribute('data-sampled');
    for (const input of all<HTMLInputElement>(scene, 'input')) {
      input.disabled = false;
      input.checked = input.type === 'checkbox';
    }
    for (const row of rows(scene)) {
      row.removeAttribute('data-mark');
      row.removeAttribute('data-off');
      row.removeAttribute('data-sampled');
    }
    if (kind(scene) === 'answer') scene.dataset.answer = 'none';
    if (kind(scene) === 'choose') {
      scene.dataset.choice = 'none';
      applyChoice(scene);
    }
    if (kind(scene) === 'turn') scene.dataset.facing = 'right';
    if (kind(scene) === 'toggle') applyChannels(scene);
    const tally = scene.querySelector('[data-tally]');
    if (tally) tally.textContent = '';
  }

  /** Marks the step done. Returns true the first time, when the results come into view. */
  function completeTask(scene: HTMLElement): boolean {
    const first = !scene.hasAttribute('data-task-done');
    scene.setAttribute('data-task-done', '');
    if (scene.dataset.state !== 'playing') scene.dataset.state = 'done';
    syncLearner();
    return first;
  }

  /** The city scene: what the map cell shows follows the number of channels switched on. */
  function applyChannels(scene: HTMLElement): void {
    const svg = svgOf(scene);
    const off: string[] = [];
    for (const input of all<HTMLInputElement>(scene, 'input[data-channel]')) {
      const row = input.closest('[data-entry]');
      if (input.checked) row?.removeAttribute('data-off');
      else {
        row?.setAttribute('data-off', '');
        off.push(input.dataset.channel ?? '');
      }
    }
    const count = all(scene, 'input[data-channel]').length - off.length;
    scene.dataset.count = String(count);
    svg?.setAttribute('data-off', off.join(' '));
    svg?.setAttribute('data-count', String(count));
  }

  function updateTally(scene: HTMLElement): void {
    const tally = scene.querySelector<HTMLElement>('[data-tally]');
    if (!tally) return;
    const entries = rows(scene);
    const confirmed = entries.filter((row) => row.dataset.mark === 'yes').length;
    tally.textContent = (tally.dataset.template ?? '')
      .replace('{n}', String(confirmed))
      .replace('{total}', String(entries.length));
  }

  /** The dining-hall scene keeps what the visitor confirmed in the dorm scene. */
  function syncLearner(): void {
    const dorm = sceneOf('dorm');
    const dining = sceneOf('dining');
    if (!dorm || !dining) return;
    const dormDone = dorm.hasAttribute('data-task-done');
    const kept = dormDone
      ? rows(dorm)
          .filter((row) => row.dataset.mark === 'yes')
          .map((row) => row.dataset.name ?? '')
      : [];
    const block = dining.querySelector<HTMLElement>('[data-carried]');
    const list = dining.querySelector('[data-carried-list]');
    if (block && list) {
      block.hidden = kept.length === 0;
      list.replaceChildren(
        ...kept.map((name) => {
          const item = document.createElement('li');
          item.textContent = name;
          return item;
        }),
      );
    }
    for (const row of rows(dining)) {
      const also = row.querySelector<HTMLElement>('[data-also]');
      if (also) also.hidden = !kept.includes(row.dataset.name ?? '');
    }
    const both = dining.querySelector<HTMLElement>('[data-both]');
    if (both) both.dataset.open = String(dormDone && dining.hasAttribute('data-task-done'));
  }

  /** Sample answers for whatever the visitor left open, so "Show all" can show the results. */
  function fillSamples(scene: HTMLElement): void {
    if (scene.hasAttribute('data-task-done')) return;
    if (kind(scene) === 'judge') {
      for (const row of rows(scene)) {
        if (row.dataset.mark) continue;
        const sample = row.dataset.sample ?? 'yes';
        const input = row.querySelector<HTMLInputElement>(`input[value="${sample}"]`);
        if (input) input.checked = true;
        row.dataset.mark = sample;
        row.setAttribute('data-sampled', '');
        scene.setAttribute('data-sampled', '');
      }
      updateTally(scene);
    }
    if (kind(scene) === 'answer' && scene.dataset.answer === 'none') {
      const sample = scene.querySelector<HTMLInputElement>('input[data-sample]');
      if (sample) {
        sample.checked = true;
        scene.dataset.answer = sample.value;
        scene.setAttribute('data-sampled', '');
      }
    }
    if (kind(scene) === 'choose' && scene.dataset.choice === 'none') {
      const sample = scene.querySelector<HTMLInputElement>('input[data-sample]');
      if (sample) {
        sample.checked = true;
        scene.dataset.choice = sample.value;
        scene.setAttribute('data-sampled', '');
        applyChoice(scene);
      }
    }
    completeTask(scene);
  }

  /**
   * A page that the browser rebuilds from its history (Back, a restored tab) gets its old form
   * states put back after this script has reset them. The scenes hold the truth, so the
   * controls are set from them once the page is shown.
   */
  function syncInputs(): void {
    for (const scene of scenes) {
      for (const input of all<HTMLInputElement>(scene, 'input')) {
        const row = input.closest<HTMLElement>('[data-entry]');
        if (input.type === 'checkbox') input.checked = !row?.hasAttribute('data-off');
        else if (kind(scene) === 'answer') input.checked = input.value === scene.dataset.answer;
        else if (kind(scene) === 'choose') input.checked = input.value === scene.dataset.choice;
        else input.checked = input.value === row?.dataset.mark;
      }
    }
  }

  // ------------------------------------------------------------------ controls

  function select(scene: HTMLElement): void {
    if (scene === current) return;
    token++;
    hush();
    // The first scene was still waiting to be drawn: it draws when the visitor comes back to it.
    if (armed) seen.delete(current);
    armed = false;
    // Leave the scene we are leaving in a finished state, so coming back never shows half of it.
    if (current.dataset.state === 'playing') settle(current);
    current = scene;
    for (const button of buttons)
      button.setAttribute(
        'aria-pressed',
        String(button.dataset.sceneButton === scene.dataset.scene),
      );
    for (const other of scenes) other.classList.toggle('is-active', other === scene);
    syncLearner();
    if (seen.has(scene)) return;
    seen.add(scene);
    if (reduce.matches) {
      settle(scene);
      say(visibleText(scene, '.sk__prompt'));
    } else void play(scene, true);
  }

  root.addEventListener('click', (event) => {
    const target = event.target as Element | null;
    const sceneButton = target?.closest<HTMLButtonElement>('[data-scene-button]');
    if (sceneButton) {
      const scene = sceneOf(sceneButton.dataset.sceneButton ?? '');
      if (scene) select(scene);
      return;
    }
    if (target?.closest('[data-replay]')) {
      resetTask(current);
      syncLearner();
      seen.add(current);
      if (reduce.matches) {
        finish(current);
        say(visibleText(current, '.sk__prompt'));
      } else void play(current, true);
      return;
    }
    if (target?.closest('[data-show-all]')) {
      finish(current);
      fillSamples(current);
      say(
        [
          root.dataset.shown ?? '',
          visibleText(current, '.sk__sample-note'),
          visibleText(current, '.sk__results .sk__result'),
        ].join(' '),
      );
      return;
    }
    // The puppet turns from its button, or from a tap on the puppet itself.
    const turn = target?.closest('[data-turn]');
    const scene = turn?.closest<HTMLElement>('[data-scene]');
    if (turn && scene && scene.dataset.state !== 'playing') {
      scene.dataset.facing = scene.dataset.facing === 'left' ? 'right' : 'left';
      sayStep(scene, '.sk__status .sk__when', completeTask(scene));
    }
  });

  root.addEventListener('change', (event) => {
    const input = event.target as HTMLInputElement | null;
    const scene = input?.closest<HTMLElement>('[data-scene]');
    if (!input || !scene) return;
    // A control used while its scene is still drawing ends the drawing: the visitor has moved on.
    if (scene.dataset.state === 'playing') finish(scene);
    if (kind(scene) === 'judge') {
      const row = input.closest<HTMLElement>('[data-entry]');
      if (!row) return;
      row.dataset.mark = input.value;
      // A mark the visitor makes is theirs, also where "Show all" had filled in a sample.
      row.removeAttribute('data-sampled');
      const entries = rows(scene);
      scene.toggleAttribute(
        'data-sampled',
        entries.some((entry) => entry.hasAttribute('data-sampled')),
      );
      if (entries.every((entry) => entry.dataset.mark)) {
        updateTally(scene);
        if (completeTask(scene)) sayStep(scene, '[data-tally]', true);
      } else {
        syncLearner();
      }
    } else if (kind(scene) === 'answer') {
      scene.dataset.answer = input.value;
      scene.removeAttribute('data-sampled');
      sayStep(scene, '.sk__entry--label .sk__when', completeTask(scene));
    } else if (kind(scene) === 'toggle') {
      applyChannels(scene);
      sayStep(scene, '.sk__status .sk__when', completeTask(scene));
    } else if (kind(scene) === 'choose') {
      scene.dataset.choice = input.value;
      scene.removeAttribute('data-sampled');
      applyChoice(scene);
      sayStep(scene, '.sk__status .sk__when', completeTask(scene));
    }
  });

  root.addEventListener('keydown', (event) => {
    if (event.key !== 'Tab' || event.shiftKey || current.dataset.state !== 'playing') return;
    // A scene's own controls are out of reach while it draws, so Tab from the last button would
    // jump past the scene. The drawing ends instead, and the step takes the focus.
    if ((event.target as Element | null)?.closest('[data-show-all]')) finish(current);
  });

  window.addEventListener('pageshow', syncInputs);

  // ------------------------------------------------------------------ start

  root.setAttribute('data-enhanced', '');
  for (const scene of scenes) {
    resetTask(scene);
    settle(scene);
  }
  syncLearner();
  seen.add(first);

  if (!reduce.matches && 'IntersectionObserver' in window) {
    // The first scene waits as blank paper until half of its drawing is in the window.
    clear(first);
    armed = true;
    new IntersectionObserver(
      (entries) => {
        if (armed && entries.some((entry) => entry.isIntersecting)) void play(current, false);
      },
      { threshold: 0.5 },
    ).observe(svgOf(first) ?? root);
    new IntersectionObserver((entries) => {
      // Scrolled away in the middle of a drawing: show it finished rather than draw unseen.
      const gone = entries.every((entry) => !entry.isIntersecting);
      if (gone && !armed && current.dataset.state === 'playing') finish(current);
    }).observe(root);
  }

  reduce.addEventListener('change', () => {
    if (reduce.matches && current.dataset.state === 'playing') finish(current);
  });

  // An address that names a scene by its heading, such as /#sk-puppet or /#sk-zoom (the
  // Experiments page links them, D74, D76), opens that scene and brings it into view. Without JavaScript every scene is shown, so the anchor just works.
  function openFromHash(): void {
    const id = /^#sk-([a-z]+)$/.exec(window.location.hash)?.[1];
    const scene = id ? sceneOf(id) : undefined;
    if (!scene) return;
    select(scene);
    scene.querySelector('.sk__heading')?.scrollIntoView({ block: 'start' });
  }
  openFromHash();
  window.addEventListener('hashchange', openFromHash);
}

const sketch = document.querySelector<HTMLElement>('[data-sketch]');
if (sketch) init(sketch);
