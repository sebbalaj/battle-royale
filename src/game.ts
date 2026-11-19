import type {
  Campaign,
  Character,
  ConflictOutcome,
  Crate,
  DangerEvent,
  FightExchange,
  HealEvent,
  HealingPoint,
  MapWeapon,
  Movement,
  Settings,
  SniperShot,
  WeaponPickup,
  WeaponType,
} from "./types";

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

const formatPowerChange = (change: number): string => (change > 0 ? `+${change}` : String(change));

// --- Weapon helpers -------------------------------------------------------

const WEAPON_NAMES: Record<WeaponType, string> = {
  "suppressed-pistol": "Suppressed Pistol",
  sniper: "Sniper",
  knife: "Knife",
  shotgun: "Shotgun",
};

const nameOfWeapon = (weapon?: WeaponType): string => (weapon ? WEAPON_NAMES[weapon] : "no weapon");

// Secret combat bonus. Sniper grants no combat bonus.
const combatBonus = (settings: Settings, weapon?: WeaponType): number =>
  weapon ? settings.weaponBonuses[weapon] ?? 0 : 0;

// A candidate weapon is kept only when it has a strictly higher combat bonus
// than the current one (sniper's bonus is 0 for this comparison). Because the
// sniper bonus is 0, a sniper is only taken when the character currently has no
// weapon or another 0-bonus weapon; this matches "always keep the better weapon
// by power bonus".
const isBetterWeapon = (settings: Settings, candidate: WeaponType, current?: WeaponType): boolean =>
  combatBonus(settings, candidate) > combatBonus(settings, current);

// --- Combat maths ---------------------------------------------------------

const calculateWinChance = (firstEffective: number, secondEffective: number): number =>
  clamp(0.5 + (firstEffective - secondEffective) * 0.05, 0.05, 0.95);

const calculateDeathChance = (
  settings: Settings,
  winnerEffective: number,
  loserEffective: number,
  loserBasePower: number,
  invulnerable: boolean,
): number => {
  if (invulnerable) return 0;
  const lowPowerPenalty = loserBasePower <= 2 ? settings.deathChanceLowPowerBonus : 0;
  return clamp(
    settings.deathChanceBase + (winnerEffective - loserEffective) * settings.deathChancePerPower + lowPowerPenalty,
    0.1,
    0.9,
  );
};

// --- Text builders --------------------------------------------------------

const buildBasicText = (
  campaign: Campaign,
  round: number,
  movements: Movement[],
  conflicts: ConflictOutcome[],
  pickups: WeaponPickup[],
  sniperShots: SniperShot[],
  healEvents: HealEvent[],
  dangerEvents: DangerEvent[],
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

  const pickupEvents = pickups.map((pickup) => {
    const who = nameOfCharacter(campaign, pickup.characterId);
    const where = nameOfArea(campaign, pickup.areaId);
    const sourceText =
      pickup.source === "crate" ? "from a crate" : pickup.source === "drop" ? "from a fallen rival" : "off the ground";
    const replacedText = pickup.replaced ? ` (dropping their ${nameOfWeapon(pickup.replaced)})` : "";
    return `- ${who} picked up a ${nameOfWeapon(pickup.weapon)} ${sourceText} at ${where}${replacedText}.`;
  });

  const sniperEvents = sniperShots.map((shot) => {
    const shooter = nameOfCharacter(campaign, shot.shooterId);
    const target = nameOfCharacter(campaign, shot.targetId);
    if (!shot.hit) return `- ${shooter} fired a sniper shot at ${target} but missed.`;
    if (shot.targetDies) return `- ${shooter} shot ${target} with a sniper and killed them.`;
    if (shot.instantKill)
      return `- ${shooter} landed a lethal sniper shot on ${target}, but they could not be killed and held on at ${shot.targetPowerAfter} power.`;
    return `- ${shooter} shot ${target} with a sniper for ${shot.damage} damage (${shot.targetPowerBefore} → ${shot.targetPowerAfter}).`;
  });

  const healEventLines = healEvents.map((event) => {
    const who = nameOfCharacter(campaign, event.characterId);
    return `- ${who} healed ${event.amount} power at ${event.pointName} (${event.powerBefore} → ${event.powerAfter}).`;
  });

  const dangerEventLines = dangerEvents.map((event) => {
    const who = nameOfCharacter(campaign, event.characterId);
    const outcome = event.died ? " and was killed" : "";
    return `- ${who} took ${event.damage} damage at ${event.pointName} (${event.powerBefore} → ${event.powerAfter})${outcome}.`;
  });

  const eventLines = [
    ...deathEvents,
    ...conflictEvents,
    ...pickupEvents,
    ...sniperEvents,
    ...dangerEventLines,
    ...healEventLines,
  ];

  return `ROUND ${round}\n\nMOVEMENTS AND POWER\n${movementLines.join("\n")}\n\nMAJOR EVENTS\n${eventLines.length ? eventLines.join("\n") : "- No major events occurred."}`;
};

const describeFight = (campaign: Campaign, fight: FightExchange): string => {
  const winner = nameOfCharacter(campaign, fight.winnerId);
  const loser = nameOfCharacter(campaign, fight.loserId);
  const winnerWeapon = campaign.characters.find((character) => character.id === fight.winnerId)?.weapon;
  const loserWeapon = campaign.characters.find((character) => character.id === fight.loserId)?.weapon;
  const chance = Math.round(fight.winnerChance * 100);
  const weaponNote = `${winner} wielded ${nameOfWeapon(winnerWeapon)}; ${loser} wielded ${nameOfWeapon(loserWeapon)}.`;
  const winnerResult = `${winner} won with a ${chance}% chance and lost ${fight.winnerDamage} power (${fight.winnerPowerBefore} → ${fight.winnerPowerAfter}).`;
  if (fight.loserFate === "died") {
    const drop = loserWeapon ? ` ${loser}'s ${nameOfWeapon(loserWeapon)} dropped at the scene.` : "";
    return `- ${weaponNote} ${winnerResult} ${loser} died in the fight.${drop}`;
  }
  const escapeArea = nameOfArea(campaign, fight.escapeAreaId ?? "");
  const deathChance = Math.round(fight.loserDeathChance * 100);
  return `- ${weaponNote} ${winnerResult} ${loser} escaped to ${escapeArea} with ${fight.loserPowerAfter} power after surviving a ${deathChance}% death chance.`;
};

const buildConflictText = (campaign: Campaign, round: number, conflicts: ConflictOutcome[], pickups: WeaponPickup[]): string => {
  if (!conflicts.length) return "";
  const resultLines = conflicts.flatMap((conflict) => [
    `AT ${nameOfArea(campaign, conflict.areaId).toUpperCase()}`,
    ...conflict.fights.map((fight) => describeFight(campaign, fight)),
  ]);
  const dropPickups = pickups.filter((pickup) => pickup.source === "drop");
  const pickupLines = dropPickups.map((pickup) => {
    const who = nameOfCharacter(campaign, pickup.characterId);
    const replacedText = pickup.replaced ? `, dropping their ${nameOfWeapon(pickup.replaced)}` : "";
    return `- ${who} claimed a ${nameOfWeapon(pickup.weapon)} from the fallen${replacedText}.`;
  });
  const entries = shuffle(parseEntries(campaign.phraseSource)).slice(0, 12);
  const pickupSection = pickupLines.length ? `\n\nWEAPON DROPS\n${pickupLines.join("\n")}` : "";
  return `ROUND ${round} — CONFLICT RESULTS\n\n${resultLines.join("\n")}${pickupSection}\n\nSTORY WORDS AND PHRASES\n${entries.join("; ")}`;
};

export const buildSetupPrompt = (campaign: Campaign): string => {
  const cellLines = campaign.areas.map((area) => {
    const neighbors = area.neighborIds
      .map((id) => nameOfArea(campaign, id))
      .filter((name) => name !== "Unknown area");
    const connects = neighbors.length ? neighbors.join(", ") : "nowhere";
    return `- ${area.name} connects to: ${connects}.`;
  });

  const healLines = campaign.healingPoints.map(
    (point) =>
      `- ${point.name} at ${nameOfArea(campaign, point.areaId)}: heals ${point.healAmount} power, ${Math.round(
        point.chance * 100,
      )}% chance, ${point.cooldownRounds}-round cooldown.`,
  );

  const dangerLines = campaign.dangerPoints.map(
    (point) =>
      `- ${point.name} at ${nameOfArea(campaign, point.areaId)}: deals ${point.minDamage}-${point.maxDamage} damage each round it is occupied.`,
  );

  const characterLines = campaign.characters.map((character) => {
    const start = nameOfArea(campaign, character.startAreaId);
    const invuln = character.invulnerable ? ", invulnerable (cannot be killed)" : "";
    const weapon = character.weapon ? `, carrying a ${nameOfWeapon(character.weapon)}` : "";
    return `- ${character.name} starts at ${start}${invuln}${weapon}.`;
  });

  const crateLines = campaign.crates.map((crate) => `- A supply crate sits at ${nameOfArea(campaign, crate.areaId)}.`);

  const section = (title: string, lines: string[], emptyNote: string): string =>
    `${title}\n${lines.length ? lines.join("\n") : `- ${emptyNote}`}`;

  const rules = [
    "- Each round every living character randomly shifts power and either stays or moves to a connected cell.",
    "- When two or more characters share a cell, a conflict breaks out; higher power wins more often, and the loser may die or escape to a neighbouring cell.",
    "- Weapons give a hidden combat edge (shotgun strongest, then suppressed pistol, then knife). The sniper gives no close-combat edge.",
    "- A character carries one weapon and always keeps the stronger one; weaker finds are left behind.",
    "- A sniper holder has a small chance each round to shoot a random character in a connected cell; such a shot can be an instant kill or deal flat damage.",
    "- Healing points restore power on a chance then go on cooldown. Danger points always hurt whoever stands on them and can kill the vulnerable.",
    "- Crates may be opened on arrival to reveal a weapon. Weapons dropped by the fallen can be claimed.",
  ];

  return [
    `CAMPAIGN: ${campaign.name}`,
    "",
    section("CELLS AND CONNECTIONS", cellLines, "No cells defined."),
    "",
    section("HEALING POINTS", healLines, "None."),
    "",
    section("DANGER POINTS", dangerLines, "None."),
    "",
    section("CHARACTERS", characterLines, "None."),
    "",
    section("CRATES", crateLines, "None."),
    "",
    `RULES\n${rules.join("\n")}`,
  ].join("\n");
};

// --- Conflict resolution --------------------------------------------------

const resolveConflict = (campaign: Campaign, areaId: string, occupants: Character[]): ConflictOutcome => {
  const settings = campaign.settings;
  const projected = new Map(occupants.map((character) => [character.id, { ...character }]));
  const fightOrder = shuffle(occupants.map((character) => character.id));
  let controllerId = fightOrder[0];
  const fights: FightExchange[] = [];

  for (const challengerId of fightOrder.slice(1)) {
    const first = projected.get(controllerId)!;
    const second = projected.get(challengerId)!;
    const firstEffective = first.power + combatBonus(settings, first.weapon);
    const secondEffective = second.power + combatBonus(settings, second.weapon);
    const firstWinChance = calculateWinChance(firstEffective, secondEffective);
    const firstWins = Math.random() < firstWinChance;
    const winner = firstWins ? first : second;
    const loser = firstWins ? second : first;
    const winnerEffective = firstWins ? firstEffective : secondEffective;
    const loserEffective = firstWins ? secondEffective : firstEffective;
    const winnerChance = firstWins ? firstWinChance : 1 - firstWinChance;
    const winnerPowerBefore = winner.power;
    const winnerDamage = randomInteger(0, Math.floor(winner.power * settings.winnerDamageCapPct));
    const winnerPowerAfter = winner.power - winnerDamage;
    const loserDeathChance = calculateDeathChance(
      settings,
      winnerEffective,
      loserEffective,
      loser.power,
      loser.invulnerable,
    );
    const loserDies = !loser.invulnerable && Math.random() < loserDeathChance;
    const eligibleEscapes =
      campaign.areas
        .find((area) => area.id === areaId)
        ?.neighborIds.filter((neighborId) => campaign.areas.some((area) => area.id === neighborId)) ?? [];
    const escapeAreaId = loserDies || eligibleEscapes.length === 0 ? undefined : choose(eligibleEscapes);
    const loserPowerAfter = loserDies ? 0 : randomInteger(settings.escapePowerMin, settings.escapePowerMax);

    projected.set(winner.id, { ...winner, power: winnerPowerAfter, lastOpponentId: loser.id });
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

// --- Ground weapon and crate pickups (applied at Advance) -----------------

type PickupResult = {
  characters: Character[];
  weapons: MapWeapon[];
  crates: Crate[];
  pickups: WeaponPickup[];
};

// Resolve ground weapons and crates for every surviving, non-conflicted
// character after movement. The pickups are ROLLED (locked) at Advance but
// NOT committed to the board: the returned characters/weapons/crates are a
// PROJECTION used only to decide downstream rolls (e.g. who now holds a
// sniper). The actual weapon/crate changes are applied at Reveal, so the map
// shows weapons exactly as they were at the start of the round until Reveal.
// A character in a conflict this round does not scavenge; they are fighting.
const resolveGroundPickups = (
  campaign: Campaign,
  characters: Character[],
  conflictAreaIds: Set<string>,
): PickupResult => {
  const settings = campaign.settings;
  let weapons = [...campaign.weapons];
  let crates = campaign.crates.map((crate) => ({ ...crate }));
  const pickups: WeaponPickup[] = [];

  const nextCharacters = characters.map((character): Character => {
    if (character.status !== "active") return character;
    if (conflictAreaIds.has(character.areaId)) return character;

    let current = character.weapon;

    // Ground weapons: auto pick up the best better-than-current one on arrival.
    const groundHere = weapons.filter((weapon) => weapon.areaId === character.areaId);
    const bestGround = groundHere
      .filter((weapon) => isBetterWeapon(settings, weapon.weapon, current))
      .sort((a, b) => combatBonus(settings, b.weapon) - combatBonus(settings, a.weapon))[0];
    if (bestGround) {
      const replaced = current;
      // Take the ground weapon off the cell.
      weapons = weapons.filter((weapon) => weapon.id !== bestGround.id);
      current = bestGround.weapon;
      pickups.push({
        characterId: character.id,
        areaId: character.areaId,
        weapon: bestGround.weapon,
        source: "ground",
        replaced,
      });
      // The replaced weapon drops back onto the cell for later pickup.
      if (replaced) {
        weapons = [...weapons, { id: crypto.randomUUID(), areaId: character.areaId, weapon: replaced }];
      }
    }

    // Crates: chance to open on entering; take contents if better.
    const crateHere = crates.find((crate) => crate.areaId === character.areaId && !crate.opened);
    if (crateHere && Math.random() < settings.crateFindChance) {
      crates = crates.map((crate) => (crate.id === crateHere.id ? { ...crate, opened: true } : crate));
      if (isBetterWeapon(settings, crateHere.weapon, current)) {
        const replaced = current;
        current = crateHere.weapon;
        pickups.push({
          characterId: character.id,
          areaId: character.areaId,
          weapon: crateHere.weapon,
          source: "crate",
          replaced,
        });
        if (replaced) {
          weapons = [...weapons, { id: crypto.randomUUID(), areaId: character.areaId, weapon: replaced }];
        }
      }
    }

    return current === character.weapon ? character : { ...character, weapon: current };
  });

  return { characters: nextCharacters, weapons, crates, pickups };
};

// --- Sniper targeting (locked at Advance) ---------------------------------

const rollSniperShots = (
  campaign: Campaign,
  characters: Character[],
  conflictAreaIds: Set<string>,
): SniperShot[] => {
  const settings = campaign.settings;
  const shots: SniperShot[] = [];

  for (const shooter of characters) {
    if (shooter.status !== "active" || shooter.weapon !== "sniper") continue;
    // A shooter caught in a conflict this round is busy fighting and does not
    // fire. Excluding conflict cells also keeps the two-phase invariant clean:
    // a sniper never pre-locks a shot against someone whose power/position is
    // still being decided by a conflict in the same Reveal.
    if (conflictAreaIds.has(shooter.areaId)) continue;
    if (Math.random() >= settings.sniperHitChance) continue;
    const area = campaign.areas.find((candidate) => candidate.id === shooter.areaId);
    const neighborIds = area?.neighborIds ?? [];
    const targets = characters.filter(
      (character) =>
        character.status === "active" &&
        character.id !== shooter.id &&
        neighborIds.includes(character.areaId) &&
        // Never target a character who is in a conflict this round: their fate
        // (death, escape, power) is decided at Reveal and must not be clobbered.
        !conflictAreaIds.has(character.areaId),
    );
    if (!targets.length) continue;
    const target = choose(targets);
    const instantKill = Math.random() < settings.sniperInstantKillChance;
    const damage = settings.sniperFlatDamage;
    const powerBefore = target.power;
    // powerDelta is the signed change applied against live power at Reveal.
    // For an instant kill the delta is unused (the shot kills outright unless
    // the target is invulnerable); for a flat shot it is -damage.
    const powerDelta = instantKill ? 0 : -damage;
    let powerAfter: number;
    let targetDies: boolean;
    if (instantKill) {
      targetDies = !target.invulnerable;
      powerAfter = targetDies ? 0 : Math.max(1, powerBefore);
    } else {
      const raw = powerBefore - damage;
      targetDies = !target.invulnerable && raw <= 0;
      powerAfter = targetDies ? 0 : target.invulnerable ? Math.max(1, raw) : raw;
    }
    shots.push({
      shooterId: shooter.id,
      targetId: target.id,
      hit: true,
      instantKill,
      damage,
      targetPowerBefore: powerBefore,
      targetPowerAfter: powerAfter,
      powerDelta,
      targetDies,
    });
  }

  return shots;
};

// --- Healing points (success + target locked at Advance) ------------------

const rollHealEvents = (
  campaign: Campaign,
  characters: Character[],
  conflictAreaIds: Set<string>,
): HealEvent[] => {
  const events: HealEvent[] = [];
  for (const point of campaign.healingPoints) {
    if (point.cooldownRemaining > 0) continue;
    // A contested cell resolves its conflict at Reveal; skip healing there so a
    // pre-rolled absolute power cannot overwrite the fight result, and so an
    // escaping loser is not healed from a cell they are leaving.
    if (conflictAreaIds.has(point.areaId)) continue;
    const occupants = characters.filter(
      (character) => character.status === "active" && character.areaId === point.areaId,
    );
    if (!occupants.length) continue;
    if (Math.random() >= point.chance) continue;
    const occupant = choose(occupants);
    const powerBefore = occupant.power;
    events.push({
      characterId: occupant.id,
      pointId: point.id,
      pointName: point.name,
      areaId: point.areaId,
      amount: point.healAmount,
      powerBefore,
      powerAfter: powerBefore + point.healAmount,
    });
  }
  return events;
};

// --- Danger points (damage locked at Advance) -----------------------------

const rollDangerEvents = (
  campaign: Campaign,
  characters: Character[],
  conflictAreaIds: Set<string>,
): DangerEvent[] => {
  const events: DangerEvent[] = [];
  for (const point of campaign.dangerPoints) {
    // A contested cell resolves its conflict at Reveal; skip danger there so a
    // pre-rolled absolute power cannot overwrite the fight result, and so an
    // escaping loser is not harmed by a cell they are leaving. The conflict
    // itself already applies damage/death that round.
    if (conflictAreaIds.has(point.areaId)) continue;
    const occupants = characters.filter(
      (character) => character.status === "active" && character.areaId === point.areaId,
    );
    for (const occupant of occupants) {
      const damage = randomInteger(point.minDamage, point.maxDamage);
      const powerBefore = occupant.power;
      const raw = powerBefore - damage;
      const died = !occupant.invulnerable && raw <= 0;
      const powerAfter = died ? 0 : occupant.invulnerable ? Math.max(1, raw) : raw;
      events.push({
        characterId: occupant.id,
        pointId: point.id,
        pointName: point.name,
        areaId: point.areaId,
        damage,
        powerBefore,
        powerAfter,
        died,
      });
    }
  }
  return events;
};

// Advance cooldowns: tick down every healing point, then reset the ones that
// fired this round to a full cooldown.
const advanceHealCooldowns = (campaign: Campaign, healEvents: HealEvent[]): HealingPoint[] => {
  const firedPointIds = new Set(healEvents.map((event) => event.pointId));
  return campaign.healingPoints.map((point) => {
    if (firedPointIds.has(point.id)) {
      return { ...point, cooldownRemaining: point.cooldownRounds };
    }
    return { ...point, cooldownRemaining: Math.max(0, point.cooldownRemaining - 1) };
  });
};

// --- Round driver ---------------------------------------------------------

export const runRound = (campaign: Campaign): Campaign => {
  const settings = campaign.settings;
  const movements: Movement[] = [];
  const nextRound = campaign.game.round + 1;

  const movedCharacters = campaign.characters.map((character): Character => {
    if (character.status !== "active") return character;
    const powerBefore = character.power;
    const powerChange = randomInteger(settings.powerChangeMin, settings.powerChangeMax);
    const changedPower = powerBefore + powerChange;
    const powerAfter = character.invulnerable ? Math.max(1, changedPower) : Math.max(0, changedPower);

    if (powerAfter <= 0) {
      const opponent = character.lastOpponentId ? nameOfCharacter(campaign, character.lastOpponentId) : "";
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
        diedInRound: nextRound,
      };
    }

    const area = campaign.areas.find((candidate) => candidate.id === character.areaId);
    const eligibleNeighbors =
      area?.neighborIds.filter((neighborId) => campaign.areas.some((candidate) => candidate.id === neighborId)) ?? [];
    const stays = Math.random() < settings.stayChance || eligibleNeighbors.length === 0;
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
    return occupants.length >= 2 ? [resolveConflict({ ...campaign, characters: movedCharacters }, area.id, occupants)] : [];
  });
  const conflictAreaIds = new Set(conflicts.map((conflict) => conflict.areaId));

  // Ground weapon + crate pickups are ROLLED and LOCKED here but applied at
  // Reveal, like every other hidden outcome. `charactersWithWeapons` is a
  // projection used only to decide downstream rolls (sniper holders) and to
  // phrase the round text; it is NOT persisted to the board this phase.
  const pickupResult = resolveGroundPickups(campaign, movedCharacters, conflictAreaIds);
  const charactersWithWeapons = pickupResult.characters;

  // Sniper / heal / danger are rolled and locked here, applied at Reveal.
  // Characters standing in a contested cell are excluded: their power and
  // position are decided by the conflict at Reveal, so letting a point or
  // sniper pre-lock an absolute power against the pre-conflict value would
  // silently discard the fight result (and could hit an escaped loser at a
  // cell they left). Conflicts already apply damage/death on those cells.
  const sniperShots = rollSniperShots(campaign, charactersWithWeapons, conflictAreaIds);
  const healEvents = rollHealEvents(campaign, charactersWithWeapons, conflictAreaIds);
  const dangerEvents = rollDangerEvents(campaign, charactersWithWeapons, conflictAreaIds);
  const healingPointsAfter = advanceHealCooldowns(campaign, healEvents);

  // Text is phrased from the projection (so weapon names read correctly), but
  // the board we persist this phase keeps the ORIGINAL weapons, crates and
  // character weapons. Only movement, power change, cooldown ticks and the
  // locked pending outcomes change at Advance. Weapons reset to their start-of
  // round state and only move at Reveal.
  const textCampaign: Campaign = {
    ...campaign,
    characters: charactersWithWeapons,
    weapons: pickupResult.weapons,
    crates: pickupResult.crates,
    healingPoints: healingPointsAfter,
  };

  const basicText = buildBasicText(
    textCampaign,
    nextRound,
    movements,
    conflicts,
    pickupResult.pickups,
    sniperShots,
    healEvents,
    dangerEvents,
  );
  const conflictText = buildConflictText(textCampaign, nextRound, conflicts, pickupResult.pickups);

  const campaignAfterMovement: Campaign = {
    ...campaign,
    characters: movedCharacters,
    healingPoints: healingPointsAfter,
  };

  return {
    ...campaignAfterMovement,
    game: {
      ...campaign.game,
      round: nextRound,
      phase: "outcome-hidden",
      pendingOutcomes: conflicts,
      pendingSniperShots: sniperShots,
      pendingPickups: pickupResult.pickups,
      pendingHealEvents: healEvents,
      pendingDangerEvents: dangerEvents,
      currentBasicText: basicText,
      currentConflictText: conflictText,
      history: [
        ...campaign.game.history,
        {
          round: nextRound,
          movements,
          conflicts,
          sniperShots,
          pickups: pickupResult.pickups,
          healEvents,
          dangerEvents,
          basicText,
          conflictText,
          revealed: false,
        },
      ],
    },
  };
};

// --- Reveal ----------------------------------------------------------------

export const revealOutcomes = (campaign: Campaign): Campaign => {
  let characters = campaign.characters.map((character) => ({ ...character }));
  let groundWeapons: MapWeapon[] = campaign.weapons.map((weapon) => ({ ...weapon }));
  let crates: Crate[] = campaign.crates.map((crate) => ({ ...crate }));

  const settings = campaign.settings;
  const find = (id: string) => characters.find((character) => character.id === id);

  // 0) Weapon pickups (crate / ground), rolled at Advance, applied now. This
  //    assigns the new weapon to the character, drops any replaced weapon on
  //    the cell, removes the taken ground weapon, and marks an opened crate.
  //    Deferring this to Reveal keeps weapons at their start-of-round state
  //    during the hidden phase.
  for (const pickup of campaign.game.pendingPickups) {
    const picker = find(pickup.characterId);
    if (!picker || picker.status !== "active") continue;

    if (pickup.source === "crate") {
      const crateIndex = crates.findIndex(
        (crate) => crate.areaId === pickup.areaId && !crate.opened && crate.weapon === pickup.weapon,
      );
      if (crateIndex >= 0) crates = crates.map((crate, index) => (index === crateIndex ? { ...crate, opened: true } : crate));
    } else {
      // ground / drop: remove one matching weapon lying on that cell.
      const groundIndex = groundWeapons.findIndex(
        (weapon) => weapon.areaId === pickup.areaId && weapon.weapon === pickup.weapon,
      );
      if (groundIndex >= 0) groundWeapons = groundWeapons.filter((_, index) => index !== groundIndex);
    }

    characters = characters.map((character) =>
      character.id === picker.id ? { ...character, weapon: pickup.weapon } : character,
    );
    if (pickup.replaced) {
      groundWeapons = [
        ...groundWeapons,
        { id: crypto.randomUUID(), areaId: pickup.areaId, weapon: pickup.replaced },
      ];
    }
  }

  let droppedWeapons: MapWeapon[] = [];

  // 1) Conflicts: apply fight outcomes, then weapon drops/pickups on kills.
  for (const outcome of campaign.game.pendingOutcomes) {
    for (const fight of outcome.fights) {
      const winnerName = nameOfCharacter(campaign, fight.winnerId);
      const loserBefore = find(fight.loserId);
      const loserWeapon = loserBefore?.weapon;
      const loserDied = fight.loserFate === "died";

      characters = characters.map((character): Character => {
        if (character.id === fight.winnerId) {
          return { ...character, power: fight.winnerPowerAfter, lastOpponentId: fight.loserId };
        }
        if (character.id !== fight.loserId) return character;
        return {
          ...character,
          power: fight.loserPowerAfter,
          areaId: fight.escapeAreaId ?? character.areaId,
          status: loserDied ? "dead" : "active",
          lastOpponentId: fight.winnerId,
          deathCause: loserDied ? `Died in fight with ${winnerName}.` : undefined,
          diedInRound: loserDied ? campaign.game.round : undefined,
          weapon: loserDied ? undefined : character.weapon,
        };
      });

      // The fallen rival's weapon drops; the killer claims it only if better.
      if (loserDied && loserWeapon) {
        const winner = find(fight.winnerId);
        if (winner && winner.status === "active" && isBetterWeapon(settings, loserWeapon, winner.weapon)) {
          const replaced = winner.weapon;
          characters = characters.map((character) =>
            character.id === winner.id ? { ...character, weapon: loserWeapon } : character,
          );
          if (replaced) {
            droppedWeapons = [
              ...droppedWeapons,
              { id: crypto.randomUUID(), areaId: outcome.areaId, weapon: replaced },
            ];
          }
        } else {
          droppedWeapons = [
            ...droppedWeapons,
            { id: crypto.randomUUID(), areaId: outcome.areaId, weapon: loserWeapon },
          ];
        }
      }
    }
  }

  // Sniper / danger / heal are applied as the pre-rolled RANDOM decision (hit,
  // instant-kill, damage amount, heal amount, target choice) combined with the
  // signed power change applied against the character's LIVE power at Reveal.
  // This keeps the two-phase invariant (randomness locked at Advance, reload
  // cannot reroll) while composing correctly if more than one of these events
  // lands on the same character in one round. Characters that were in a
  // conflict this round are already excluded from these rolls at Advance, so
  // conflict results are never clobbered here.

  // 2) Sniper shots (pre-rolled). Skip targets already dead this Reveal.
  for (const shot of campaign.game.pendingSniperShots) {
    const shooter = find(shot.shooterId);
    if (!shooter || shooter.status !== "active") continue;
    characters = characters.map((character): Character => {
      if (character.id !== shot.targetId || character.status !== "active") return character;
      if (shot.instantKill) {
        if (character.invulnerable) return { ...character, power: Math.max(1, character.power) };
        return {
          ...character,
          power: 0,
          status: "dead",
          deathCause: `Shot dead by ${nameOfCharacter(campaign, shot.shooterId)}'s sniper.`,
          diedInRound: campaign.game.round,
          weapon: undefined,
        };
      }
      // Fall back to -damage for legacy pending shots saved before powerDelta.
      const delta = Number.isFinite(shot.powerDelta) ? shot.powerDelta : -shot.damage;
      const raw = character.power + delta;
      if (!character.invulnerable && raw <= 0) {
        return {
          ...character,
          power: 0,
          status: "dead",
          deathCause: `Shot dead by ${nameOfCharacter(campaign, shot.shooterId)}'s sniper.`,
          diedInRound: campaign.game.round,
          weapon: undefined,
        };
      }
      return { ...character, power: character.invulnerable ? Math.max(1, raw) : raw };
    });
  }

  // 3) Danger points (pre-rolled). Skip the already dead, and skip a character
  //    whose area changed (they left the danger cell during conflict escape).
  for (const event of campaign.game.pendingDangerEvents) {
    characters = characters.map((character): Character => {
      if (character.id !== event.characterId || character.status !== "active") return character;
      // Legacy pending events (saved before areaId was tracked) have no areaId;
      // apply them. Otherwise only apply if still in the point's cell.
      if (event.areaId && character.areaId !== event.areaId) return character;
      const raw = character.power - event.damage;
      if (!character.invulnerable && raw <= 0) {
        return {
          ...character,
          power: 0,
          status: "dead",
          deathCause: `Killed at ${event.pointName}.`,
          diedInRound: campaign.game.round,
          weapon: undefined,
        };
      }
      return { ...character, power: character.invulnerable ? Math.max(1, raw) : raw };
    });
  }

  // 4) Healing points (pre-rolled). Skip the already dead and anyone who left
  //    the healing cell during conflict escape.
  for (const event of campaign.game.pendingHealEvents) {
    characters = characters.map((character): Character => {
      if (character.id !== event.characterId || character.status !== "active") return character;
      if (event.areaId && character.areaId !== event.areaId) return character;
      return { ...character, power: character.power + event.amount };
    });
  }

  return {
    ...campaign,
    characters,
    weapons: [...groundWeapons, ...droppedWeapons],
    crates,
    game: {
      ...campaign.game,
      phase: "revealed",
      pendingOutcomes: [],
      pendingSniperShots: [],
      pendingPickups: [],
      pendingHealEvents: [],
      pendingDangerEvents: [],
      history: campaign.game.history.map((record) =>
        record.round === campaign.game.round ? { ...record, revealed: true } : record,
      ),
    },
  };
};
