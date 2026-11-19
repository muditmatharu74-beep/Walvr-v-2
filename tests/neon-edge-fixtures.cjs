// Original text only. Four-second fixture shared by browser and MP4 checks.
module.exports = [
  ...['fast', 'words', 'move', 'now.'].map((word,i)=>({word,start:i*0.08,end:(i+1)*0.08})),
  {word:'overlap',start:0.4,end:1.4},
  {word:'ends',start:0.5,end:0.7},
  ...['one', 'two', 'three', 'four', 'five'].map(word=>({word,start:1.5,end:1.9})),
  {word:'W'.repeat(40),start:2,end:2.4},
  {word:'home',start:2.5,end:2.7},
  {word:'."',start:2.7,end:2.8},
  {word:'next',start:2.9,end:3},
];
