  export function noteStats(label: string, note: number, notesCorrect, notesWrong) {
    let percentage = '';
    if (notesCorrect[note] + notesWrong[note] === 0) {
      percentage = '';
    } else {
      percentage = `(${(notesCorrect[note] * 100/(notesCorrect[note] + notesWrong[note])).toFixed(1)}%)`
    }
    return `${label} : ${notesCorrect[note]}/${notesCorrect[note] + notesWrong[note]} ${percentage}`
  }

  export function statTotals(notesCorrect, notesWrong) {
    let totalCorrect = 0;
    let totalWrong = 0;
    for (const key in notesCorrect) {
      totalCorrect += notesCorrect[key];
      totalWrong += notesWrong[key];
    }
    let percentage = '';
    if (totalCorrect + totalWrong === 0) {
      percentage = '';
    } else {
      percentage = `(${(totalCorrect * 100/(totalCorrect + totalWrong)).toFixed(1)}%)`
    }

    return `${totalCorrect}/${totalCorrect + totalWrong} ${percentage}`;
  }