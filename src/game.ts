import type { Campaign, Character, ConflictOutcome, FightExchange, Movement } from "./types";

const POWER_CHANGES = [-2, -1, 0, 1, 2] as const;

export const parseEntries = (source: string): string[] =>
  source
    .split(";")
    .map((entry) => entry.trim())
    .filter(Boolean);

const choose = <T,>(items: T[]): T => items[Math.floor(Math.random() * items.length)];
const randomInteger = (minimum: number, maximum: number): number =>
  Math.floor(Math.random() * (maximum - minimum + 1)) + minimum;
const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(maximum, Math.max(minimum, value));

const shuffle = <T,>(items: T[]): T[] => {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
};

const nameOfArea = (campaign: Campaign, areaId: string): string =>
  campaign.areas.find((area) => area.id === areaId)?.name ?? "Unknown area";

const nameOfCharacter = (campaign: Campaign, characterId: string): string =>
  campaign.characters.find((character) => character.id === characterId)?.name ?? "Unknown character";

const formatPowerChange = (change: number): string => change > 0 ? `+${change}` : String(change);

const calculateWinChance = (firstPower: number, secondPower: number): number =>
  clamp(0.5 + (firstPower - secondPower) * 0.05, 0.05, 0.95);

const calculateDeathChance = (winnerPower: number, loserPower: number, invulnerable: boolean): number => {
  if (invulnerable) return 0;
  const lowPowerPenalty = loserPower <= 2 ? 0.1 : 0;
  return clamp(0.5 + (winnerPower - loserPower) * 0.05 + lowPowerPenalty, 0.1, 0.9);
};

const buildBasicText = (
  campaign: Campaign,
  round: number,
  movements: Movement[],
  conflicts: ConflictOutcome[],
): string => {
  const movementLines = movements.map((movement) => {
    const character = nameOfCharacter(campaign, movement.characterId);
    const from = nameOfArea(campaign, movement.fromAreaId);
    const to = nameOfArea(campaign, movement.toAreaId);
    const action = movement.deathCause
      ? `${character} did not move.`
      : movement.fromAreaId === movement.toAreaId
        ? `${character} stayed at ${from}.`
        : `${character} moved from ${from} to ${to}.`;
    return `- ${action} Power ${movement.powerBefore} → ${movement.powerAfter} (${formatPowerChange(movement.powerChange)}).`;
  });

  const deathEvents = movements
    .filter((movement) => movement.deathCause)
    .map((movement) => `- ${nameOfCharacter(campaign, movement.characterId)} ${movement.deathCause}`);
  const conflictEvents = conflicts.map((conflict) => {
    const participants = conflict.participantIds.map((id) => nameOfCharacter(campaign, id));
    return `- A conflict began at ${nameOfArea(campaign, conflict.areaId)} between ${participants.join(", ")}.`;
  });
  const eventLines = [...deathEvents, ...conflictEvents];

  return `ROUND ${round}\n\nMOVEMENTS AND POWER\n${movementLines.join("\n")}\n\nMAJOR EVENTS\n${eventLines.length ? eventLines.join("\n") : "- No major events occurred."}`;
};

const describeFight = (campaign: Campaign, fight: FightExchange): string => {
  const winner = nameOfCharacter(campaign, fight.winnerId);
  const loser = nameOfCharacter(campaign, fight.loserId);
  const chance = Math.round(fight.winnerChance * 100);
  const winnerResult = `${winner} won with a ${chance}% chance and lost ${fight.winnerDamage} power (${fight.winnerPowerBefore} → ${fight.winnerPowerAfter}).`;
  if (fight.loserFate === "died") {
    return `- ${winnerResult} ${loser} died in the fight.`;
  }
  const escapeArea = nameOfArea(campaign, fight.escapeAreaId ?? "");
  const deathChance = Math.round(fight.loserDeathChance * 100);
  return `- ${winnerResult} ${loser} escaped to ${escapeArea} with ${fight.loserPowerAfter} power after surviving a ${deathChance}% death chance.`;
};

const buildConflictText = (
  campaign: Campaign,
  round: number,
  conflicts: ConflictOutcome[],
): string => {
  if (!conflicts.length) return "";
  const resultLines = conflicts.flatMap((conflict) => [
    `AT ${nameOfArea(campaign, conflict.areaId).toUpperCase()}`,
    ...conflict.fights.map((fight) => describeFight(campaign, fight)),
  ]);
  const entries = shuffle(parseEntries(campaign.phraseSource)).slice(0, 12);
  return `ROUND ${round} — CONFLICT RESULTS\n\n${resultLines.join("\n")}\n\nSTORY WORDS AND PHRASES\n${entries.join("; ")}`;
};

const resolveConflict = (
  campaign: Campaign,
  areaId: string,
  occupants: Character[],
): ConflictOutcome => {
  const projected = new Map(occupants.map((character) => [character.id, { ...character }]));
  const fightOrder = shuffle(occupants.map((character) => character.id));
  let controllerId = fightOrder[0];
  const fights: FightExchange[] = [];

  for (const challengerId of fightOrder.slice(1)) {
    const first = projected.get(controllerId)!;
    const second = projected.get(challengerId)!;
    const firstWinChance = calculateWinChance(first.power, second.power);
    const firstWins = Math.random() < firstWinChance;
    const winner = firstWins ? first : second;
    const loser = firstWins ? second : first;
    const winnerChance = firstWins ? firstWinChance : 1 - firstWinChance;
    const winnerPowerBefore = winner.power;
    const winnerDamage = randomInteger(0, Math.floor(winner.power * 0.5));
    const winnerPowerAfter = winner.power - winnerDamage;
    const loserDeathChance = calculateDeathChance(winnerPowerBefore, loser.power, loser.invulnerable);
    const loserDies = !loser.invulnerable && Math.random() < loserDeathChance;
    const eligibleEscapes = campaign.areas
      .find((area) => area.id === areaId)
      ?.neighborIds.filter((neighborId) => campaign.areas.some((area) => area.id === neighborId)) ?? [];
    const escapeAreaId = loserDies ? undefined : choose(eligibleEscapes);
    const loserPowerAfter = loserDies ? 0 : randomInteger(1, 2);

    projected.set(winner.id, {
      ...winner,
      power: winnerPowerAfter,
      lastOpponentId: loser.id,
    });
    projected.set(loser.id, {
      ...loser,
      power: loserPowerAfter,
      areaId: escapeAreaId ?? loser.areaId,
      status: loserDies ? "dead" : "active",
      lastOpponentId: winner.id,
    });

    fights.push({
      fighterIds: [first.id, second.id],
      winnerId: winner.id,
      loserId: loser.id,
      winnerChance,
      winnerPowerBefore,
      winnerDamage,
      winnerPowerAfter,
      loserPowerBefore: loser.power,
      loserFate: loserDies ? "died" : "escaped",
      loserDeathChance,
      loserPowerAfter,
      escapeAreaId,
    });
    controllerId = winner.id;
  }

  return {
    areaId,
    participantIds: occupants.map((character) => character.id),
    finalControllerId: controllerId,
    fights,
  };
};

export const runRound = (campaign: Campaign): Campaign => {
  const movements: Movement[] = [];
  const movedCharacters = campaign.characters.map((character): Character => {
    if (character.status !== "active") return character;
    const powerBefore = character.power;
    const powerChange = choose([...POWER_CHANGES]);
    const changedPower = powerBefore + powerChange;
    const powerAfter = character.invulnerable ? Math.max(1, changedPower) : Math.max(0, changedPower);

    if (powerAfter <= 0) {
      const opponent = character.lastOpponentId
        ? nameOfCharacter(campaign, character.lastOpponentId)
        : "";
      const deathCause = opponent
        ? `died from injuries from fight with ${opponent}.`
        : "died in an accident / to the elements.";
      movements.push({
        characterId: character.id,
        fromAreaId: character.areaId,
        toAreaId: character.areaId,
        powerBefore,
        powerChange,
        powerAfter,
        deathCause,
      });
      return {
        ...character,
        power: 0,
        status: "dead",
        deathCause,
        diedInRound: campaign.game.round + 1,
      };
    }

    const area = campaign.areas.find((candidate) => candidate.id === character.areaId);
    const eligibleNeighbors = area?.neighborIds.filter((neighborId) =>
      campaign.areas.some((candidate) => candidate.id === neighborId),
    ) ?? [];
    const stays = Math.random() < campaign.stayChance || eligibleNeighbors.length === 0;
    const toAreaId = stays ? character.areaId : choose(eligibleNeighbors);
    movements.push({
      characterId: character.id,
      fromAreaId: character.areaId,
      toAreaId,
      powerBefore,
      powerChange,
      powerAfter,
    });
    return { ...character, areaId: toAreaId, power: powerAfter };
  });

  const conflicts = campaign.areas.flatMap((area) => {
    const occupants = movedCharacters.filter(
      (character) => character.status === "active" && character.areaId === area.id,
    );
    return occupants.length >= 2 ? [resolveConflict(campaign, area.id, occupants)] : [];
  });

  const nextRound = campaign.game.round + 1;
  const campaignAfterMovement = { ...campaign, characters: movedCharacters };
  const basicText = buildBasicText(campaignAfterMovement, nextRound, movements, conflicts);
  const conflictText = buildConflictText(campaignAfterMovement, nextRound, conflicts);

  return {
    ...campaignAfterMovement,
    game: {
      ...campaign.game,
      round: nextRound,
      phase: "outcome-hidden",
      pendingOutcomes: conflicts,
      currentBasicText: basicText,
      currentConflictText: conflictText,
      history: [
        ...campaign.game.history,
        {
          round: nextRound,
          movements,
          conflicts,
          sniperShots: [],
          pickups: [],
          healEvents: [],
          dangerEvents: [],
          basicText,
          conflictText,
          revealed: false,
        },
      ],
    },
  };
};

export const revealOutcomes = (campaign: Campaign): Campaign => {
  let characters = campaign.characters.map((character) => ({ ...character }));

  for (const outcome of campaign.game.pendingOutcomes) {
    for (const fight of outcome.fights) {
      characters = characters.map((character): Character => {
        if (character.id === fight.winnerId) {
          return {
            ...character,
            power: fight.winnerPowerAfter,
            lastOpponentId: fight.loserId,
          };
        }
        if (character.id !== fight.loserId) return character;
        const winner = nameOfCharacter(campaign, fight.winnerId);
        return {
          ...character,
          power: fight.loserPowerAfter,
          areaId: fight.escapeAreaId ?? character.areaId,
          status: fight.loserFate === "died" ? "dead" : "active",
          lastOpponentId: fight.winnerId,
          deathCause: fight.loserFate === "died" ? `Died in fight with ${winner}.` : undefined,
          diedInRound: fight.loserFate === "died" ? campaign.game.round : undefined,
        };
      });
    }
  }

  return {
    ...campaign,
    characters,
    game: {
      ...campaign.game,
      phase: "revealed",
      pendingOutcomes: [],
      history: campaign.game.history.map((record) =>
        record.round === campaign.game.round ? { ...record, revealed: true } : record,
      ),
    },
  };
};
