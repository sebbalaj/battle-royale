import type { Campaign, ConflictOutcome, Movement } from "./types";

export const parseEntries = (source: string): string[] =>
  source
    .split(";")
    .map((entry) => entry.trim())
    .filter(Boolean);

const choose = <T,>(items: T[]): T => items[Math.floor(Math.random() * items.length)];

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
    return movement.fromAreaId === movement.toAreaId
      ? `- ${character} stayed at ${from}.`
      : `- ${character} moved from ${from} to ${to}.`;
  });

  const eventLines = conflicts.length
    ? conflicts.map((conflict) => {
        const participants = conflict.participantIds.map((id) => nameOfCharacter(campaign, id));
        return `- A conflict began at ${nameOfArea(campaign, conflict.areaId)} between ${participants.join(", ")}.`;
      })
    : ["- No conflicts occurred."];

  return `ROUND ${round}\n\nMOVEMENTS\n${movementLines.join("\n")}\n\nMAJOR EVENTS\n${eventLines.join("\n")}`;
};

const buildConflictText = (
  campaign: Campaign,
  round: number,
  conflicts: ConflictOutcome[],
): string => {
  if (!conflicts.length) return "";

  const resultLines = conflicts.map((conflict) => {
    const winner = nameOfCharacter(campaign, conflict.winnerId);
    const losers = conflict.loserIds.map((id) => nameOfCharacter(campaign, id));
    return `- At ${nameOfArea(campaign, conflict.areaId)}, ${winner} won. Defeated: ${losers.join(", ")}.`;
  });

  const entries = shuffle(parseEntries(campaign.phraseSource)).slice(0, 12);
  return `ROUND ${round} — CONFLICT RESULTS\n\n${resultLines.join("\n")}\n\nSTORY WORDS AND PHRASES\n${entries.join("; ")}`;
};

export const runRound = (campaign: Campaign): Campaign => {
  const activeCharacters = campaign.characters.filter((character) => character.status === "active");
  const movements: Movement[] = activeCharacters.map((character) => {
    const area = campaign.areas.find((candidate) => candidate.id === character.areaId);
    const eligibleNeighbors = area?.neighborIds.filter((neighborId) =>
      campaign.areas.some((candidate) => candidate.id === neighborId),
    ) ?? [];
    const stays = Math.random() < campaign.stayChance || eligibleNeighbors.length === 0;
    return {
      characterId: character.id,
      fromAreaId: character.areaId,
      toAreaId: stays ? character.areaId : choose(eligibleNeighbors),
    };
  });

  const movedCharacters = campaign.characters.map((character) => {
    const movement = movements.find((candidate) => candidate.characterId === character.id);
    return movement ? { ...character, areaId: movement.toAreaId } : character;
  });

  const conflicts: ConflictOutcome[] = campaign.areas.flatMap((area) => {
    const occupants = movedCharacters.filter(
      (character) => character.status === "active" && character.areaId === area.id,
    );
    if (occupants.length < 2) return [];
    const winner = choose(occupants);
    return [{
      areaId: area.id,
      participantIds: occupants.map((character) => character.id),
      winnerId: winner.id,
      loserIds: occupants.filter((character) => character.id !== winner.id).map((character) => character.id),
    }];
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
        { round: nextRound, movements, conflicts, basicText, conflictText, revealed: false },
      ],
    },
  };
};

export const revealOutcomes = (campaign: Campaign): Campaign => {
  const loserIds = new Set(campaign.game.pendingOutcomes.flatMap((outcome) => outcome.loserIds));
  return {
    ...campaign,
    characters: campaign.characters.map((character) =>
      loserIds.has(character.id)
        ? { ...character, status: "defeated" as const, defeatedInRound: campaign.game.round }
        : character,
    ),
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
