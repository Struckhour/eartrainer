<script lang="ts">
  import { onMount, onDestroy } from "svelte";

  export let onKeyDown: (note: number) => void;
  export let onKeyUp: (note: number) => void;
  export let pressed: Set<number> = new Set();

  const notes = [
    { name: "C", midi: 60, black: false },
    { name: "C#", midi: 61, black: true },
    { name: "D", midi: 62, black: false },
    { name: "D#", midi: 63, black: true },
    { name: "E", midi: 64, black: false },
    { name: "F", midi: 65, black: false },
    { name: "F#", midi: 66, black: true },
    { name: "G", midi: 67, black: false },
    { name: "G#", midi: 68, black: true },
    { name: "A", midi: 69, black: false },
    { name: "A#", midi: 70, black: true },
    { name: "B", midi: 71, black: false },
    { name: "C", midi: 72, black: false },
  ];

  // Map computer keys to MIDI notes
  const keyMap: Record<string, number> = {
    a: 60, w: 61, s: 62, e: 63, d: 64,
    f: 65, t: 66, g: 67, y: 68, h: 69,
    u: 70, j: 71, k: 72,
  };

  function handleKeyDown(e: KeyboardEvent) {
    const note = keyMap[e.key];
    if (note && !pressed.has(note)) onKeyDown(note);
  }

  function handleKeyUp(e: KeyboardEvent) {
    const note = keyMap[e.key];
    if (note) onKeyUp(note);
  }

  onMount(() => {
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  });

</script>

<div class="keyboard-wrapper">
  <div class="keyboard">
    {#each notes as note}
      <button
        class="key {note.black ? 'black' : 'white'} {pressed.has(note.midi) ? 'active' : ''}"
        on:mousedown={() => onKeyDown(note.midi)}
        on:mouseup={() => onKeyUp(note.midi)}
        on:mouseleave={() => onKeyUp(note.midi)}
      >
        {note.name}
      </button>
    {/each}
  </div>
</div>

<style>
.keyboard-wrapper {
  position: relative;
  height: 150px;
}

/* Base keyboard */
.keyboard {
  display: flex;
  position: relative;
  height: 100%;
}

/* White keys */
.key.white {
  width: 40px;
  height: 150px;
  border: 1px solid black;
  background: white;
  z-index: 1;
  position: relative;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  font-size: 0.8rem;
}

/* Black keys */
.key.black {
  width: 30px;
  height: 100px;
  background: black;
  color: white;
  position: absolute;
  z-index: 2;
  margin-left: -15px;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  font-size: 0.8rem;
}

/* Highlight pressed keys */
.key.white.active {
  background: #aee1ff; /* light blue */
}
.key.black.active {
  background: #3399ff; /* bright blue */
}

/* Position black keys correctly over white keys */
.key.black:nth-of-type(2)  { left: 30px; }  /* C# */
.key.black:nth-of-type(4)  { left: 70px; }  /* D# */
.key.black:nth-of-type(7)  { left: 150px; } /* F# */
.key.black:nth-of-type(9)  { left: 190px; } /* G# */
.key.black:nth-of-type(11) { left: 230px; } /* A# */
</style>
