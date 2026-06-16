const eventId = 'epicgames_S41_MobileSeriesCupQual_OCE';
const maxSeason = 41;
const isCurrentSeason = eventId.match(new RegExp(`S${maxSeason}_`, 'i'));
const windowLabel = 'Qualifier12';

console.log({
  isCurrentSeason: !!isCurrentSeason,
  windowLabel: windowLabel.toLowerCase().includes('qualifier')
});
