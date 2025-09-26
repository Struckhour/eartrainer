<script lang="ts">
  import Keyboard from "$lib/Keyboard.svelte";
  // import { initMIDI } from "$lib/midi";
  import { onMount, onDestroy } from "svelte";
  // import * as Tone from "tone";
  import { browser } from '$app/environment';
  let Tone: any;
  let pressed = new Set<number>();       // notes currently held down
  let newlyPressed = new Set<number>();  // notes that started pressing since last tick

  let beats = 0;
  let gameTimer: number | NodeJS.Timeout;
  let responseInterval: number | NodeJS.Timeout;

  let legalNotes = [60, 62, 64];
  let score = 0;
  const sixteenth = 150;
  let barsCorrect = 0;
  let notesCorrect = 0;
  let barsFailed = 0;
  let notesFailed = 0;

  type BeatKey = "beat1" | "beat2" | "beat3" | "beat4";

  let noteScores: Record<number, number> = {60: 0, 62: 0, 64: 0};

  type Bar = {
    beat1: number | null;
    beat2: number | null;
    beat3: number | null;
    beat4: number | null;
  };
  let backgroundSynth: any | null = null;
  let synth: any | null = null;
  let kick: any, snare: any, hat: any;

  function randomNoteFromArray(notes: number[]): number {
    const randomIndex = Math.floor(Math.random() * notes.length);
    return notes[randomIndex];
  }

  function playBar(): Promise<Bar> {
    return new Promise((resolve) => {
      const bar: Bar = { beat1: null, beat2: null, beat3: null, beat4: null };
      let i = 0;

      function playNextBeat() {
        const thisNote = randomNoteFromArray(legalNotes);
        playBackgroundTone(thisNote);

        const key = `beat${i + 1}` as BeatKey;
        bar[key] = thisNote;

        i++;
        if (i >= 4) {
          resolve(bar); // bar finished
        } else {
          setTimeout(playNextBeat, 4 * sixteenth); // schedule next beat
        }
      }

      playNextBeat(); // play the first beat immediately
    });
  }

  function checkScoresForWin() {
    for (const key in noteScores) {
      if (noteScores[key] < 10) return false;
    }
    return true;
  }

  let displayWin = false;
  let displayLoss = false;
  function responseBar(barNotes: Bar) {
    if (responseInterval) clearInterval(responseInterval);
    let notesPlayed: number[] = [];
    let msTicks = 0;

    let beatsCorrect = [0, 0, 0, 0];
    const beatKeys: (keyof Bar)[] = ["beat1", "beat2", "beat3", "beat4"];
    const beatWindows = [
      [3 * sixteenth, 5 * sixteenth],
      [7 * sixteenth, 9 * sixteenth],
      [11 * sixteenth, 13 * sixteenth],
      [15 * sixteenth, 17 * sixteenth],
    ];

    let currentBeatIndex = 0; // pointer to the beat we are currently checking
    let lastNote: number | null = 0;
    responseInterval = setInterval(() => {
      // record new notes
      if (notesPlayed.length < beatKeys.length && newlyPressed.size > 0) {
        const nextNote = newlyPressed.values().next().value;
        if (nextNote !== undefined) {
          notesPlayed.push(nextNote);
        }
      }

      msTicks += sixteenth;

      if (msTicks > 20 * sixteenth) {
        clearInterval(responseInterval);
        return;
      }
      
      // Only check the current beat
      if (currentBeatIndex < beatKeys.length) {
        const [start, end] = beatWindows[currentBeatIndex];
        if (msTicks >= start && msTicks <= end) {
          const key = beatKeys[currentBeatIndex];
          const note = barNotes[key];
          lastNote = note;
          if (note === null) {
            console.log(`beat ${currentBeatIndex + 1} skipped (null note)`);
            currentBeatIndex++;
          } else if (notesPlayed.slice(0, currentBeatIndex + 1).includes(note) && newlyPressed.has(note)) {
            console.log(`got beat ${currentBeatIndex + 1}!`);
            noteScores[note] = Math.min(10, noteScores[note] + 1);
            
            notesCorrect += 1;
            currentBeatIndex++;
            beatsCorrect[currentBeatIndex] = 1;
          }
        } else if (msTicks > end) {
          // time window passed without correct note
          console.log(`missed beat ${currentBeatIndex + 1}`);
          console.log(lastNote);
          notesFailed += 1;
          if (lastNote) noteScores[lastNote] = Math.max(-10, noteScores[lastNote] - 1);
          if (lastNote && noteScores[lastNote] == -10) {
            displayLoss = true;
            stopGame();
          }
          currentBeatIndex++;
        }
      }

      // Check if all beats are done
      if (currentBeatIndex >= beatKeys.length) {
        const sumBeats = beatsCorrect.reduce((total, num) => total + num, 0);
        if (notesPlayed.length === beatKeys.length && sumBeats > 3) {
          console.log("You got the whole Bar!!!!");
          barsCorrect += 1;
          score++;
          if (checkScoresForWin()) displayWin = true;
        } else {
          barsFailed += 1;
          score = Math.max(0, score -1);
        }
        clearInterval(responseInterval);
      }

      newlyPressed.clear();
    }, sixteenth);
  }

  function playBackgroundTone(note: number = 60) {
    if (!backgroundSynth) return;

    const freq = Tone.Frequency(note, "midi").toFrequency(); // convert to number
    backgroundSynth.triggerAttackRelease(freq, 2*sixteenth/1000);
  }

  onDestroy(() => {
    clearInterval(gameTimer);
  });

  // Optional: format as mm:ss
  function formatTime(s: number) {
    const m = Math.floor(s / 60).toString().padStart(2, "0");
    const sec = (s % 60).toString().padStart(2, "0");
    return `${m}:${sec}`;
  }

  function freqFromMidi(note: number) {
    return 440 * Math.pow(2, (note - 69) / 12);
  }

  function noteOn(note: number) {
    if (!browser || !synth) return;
    const freq = Tone.Frequency(note, "midi").toFrequency();

    synth.triggerAttack(freq); // starts the note
    pressed.add(note);
    newlyPressed.add(note);
    pressed = new Set(pressed);
  }

  function noteOff(note: number) {
    if (!browser || !synth) return;
    const freq = Tone.Frequency(note, "midi").toFrequency();

    synth.triggerRelease(freq); // releases with envelope
    pressed.delete(note);
    newlyPressed.delete(note);
    pressed = new Set(pressed);
  }


  async function resetGame() {
    displayLoss = false;
    displayWin = false;
    if (!Tone) {
      Tone = (await import("tone"));
    }
    await Tone.start(); 
    console.log("AudioContext started");
    
    for (const key in noteScores) {
      noteScores[key] = 0;
    }
    // Dispose old synths if they exist
    if (backgroundSynth) backgroundSynth.dispose();
    if (synth) synth.dispose();
    if (kick) kick.dispose();
    if (snare) snare.dispose();
    if (hat) hat.dispose();

    backgroundSynth = new Tone.Synth({
      oscillator: { type: "sine" },
      volume: -20,
      envelope: {
        attack: 0.01,
        decay: 0.1,
        sustain: 0.5,
        release: 0.8, // matches previous duration
      },
      }).toDestination();

    // Initialize drums
    kick = new Tone.MembraneSynth({ volume: -26 }).toDestination();
    snare = new Tone.NoiseSynth({
        volume: -20,
        noise: { type: "white" },
        envelope: { attack: 0.001, decay: 0.2, sustain: 0 }
    }).toDestination();
    hat = new Tone.MetalSynth({
        frequency: 400,
        volume: -20,
        envelope: { attack: 0.001, decay: 0.1, release: 0.1 },
        harmonicity: 5.1,
        modulationIndex: 32,
        resonance: 4000,
        octaves: 1.5
    }).toDestination();


    synth = new Tone.PolySynth(Tone.Synth).toDestination();
    clearInterval(gameTimer);
    barsCorrect = 0;
    notesCorrect = 0;
    barsFailed = 0;
    notesFailed = 0;
    beats = 0;

    gameTimer = setInterval(async () => {
      
      beats += 1;
      let bar;
      if (beats == 12) countDown();
      if (beats > 7) hat.triggerAttackRelease("16n");
      if (beats > 5 && beats % 4 == 0) kick.triggerAttackRelease("C2", "8n");
      if (beats > 5 && (beats + 4) % 8 == 0) snare.triggerAttackRelease("8n");
      // Every 8 beats, play a new bar
      if (beats % 32 === 0) {
        bar = await playBar();
        responseBar(bar);
      }

    }, sixteenth);
  }

  let displayCountdown = false;
  let count = 5;
  function countDown() {
    displayCountdown = true;

    for (let i = 5; i >= 0; i--) {
      setTimeout(() => {
        count = i;
        if (i === 0) {
          displayCountdown = false; // hide countdown after the last number
        }
      }, (5 - i) * 4 * sixteenth); // schedule each second apart
    }
  }

  function stopGame() {
    clearInterval(gameTimer);
    gameTimer = 0;
  }

  onMount(() => {

  });


</script>

<main>
  <h1 class="text-center text-4xl mt-6">Melody Duel</h1>
  <div class="flex flex-col justify-between items-center border border-purple-500 h-[800px] w-[500px] mx-auto">
    <div class="flex justify-between w-full mt-4 px-8">
      {#if gameTimer}
      <button onclick={stopGame}  class="bg-red-500 border border-black py-1 px-2 rounded-lg text-xl hover:bg-red-600 active:bg-red-800">Stop</button>
      {:else}
      <button onclick={resetGame}  class="bg-green-500 border border-black py-1 px-2 rounded-lg text-xl hover:bg-green-600 active:bg-green-800">New Game</button>
      {/if}
      <div class="text-2xl font-bold">
        {formatTime(Math.floor(beats / 4))}
      </div>
    </div>
    <div class="bg-black w-[90%] h-[400px] relative my-2 rounded-lg">
      {#if displayCountdown}
        <div class="text-6xl mb-8 text-blue-800 bg-blue-200 rounded-full absolute top-2/4 left-2/4 -translate-x-2/4 -translate-y-2/4 w-24 h-24 text-center flex items-center justify-center">{count}</div>
      {/if}
      {#if displayWin}
        <div class="text-6xl mb-8 text-blue-800 bg-blue-200 rounded-full absolute top-2/4 left-2/4 -translate-x-2/4 -translate-y-2/4 text-center flex items-center justify-center">You Win!</div>
      {/if}
      {#if displayLoss}
        <div class="text-6xl mb-8 text-blue-800 bg-blue-200 rounded-full absolute top-2/4 left-2/4 -translate-x-2/4 -translate-y-2/4 text-center flex items-center justify-center">Game Over</div>
      {/if}
      <div class="rounded-full bg-green-500 w-4 h-4 absolute left-[18%] transition-all duration-700 ease-in-out" style="top: {50 - 5 * noteScores[60]}%"></div>
      <div class="rounded-full bg-green-500 w-4 h-4 absolute left-[25%] transition-all duration-700 ease-in-out" style="top: {50 - 5 * noteScores[62]}%"></div>
      <div class="rounded-full bg-green-500 w-4 h-4 absolute left-[32%] transition-all duration-700 ease-in-out" style="top: {50 - 5 * noteScores[64]}%"></div>
    </div>

    <!-- <div class="flex w-full justify-around">
      <div class="text-4xl">{noteScores[60]}</div>
      <div class="text-4xl">{noteScores[62]}</div>
      <div class="text-4xl">{noteScores[64]}</div>
    </div> -->

    <!-- <div class="flex flex-row justify-around w-full text-xl">
      <div class="flex flex-col">
        <div>Bars Correct: {barsCorrect}</div>
        <div>Notes Correct: {notesCorrect}</div>
      </div>
      <div class="flex flex-col">
        <div>Bars Failed: {barsFailed}</div>
        <div>Notes Failed: {notesFailed}</div>
      </div>
    </div> -->


    <Keyboard
    onKeyDown={synth ? noteOn : () => {}}
    onKeyUp={synth ? noteOff : () => {}}
    {pressed}
    />

    
  </div>

</main>

