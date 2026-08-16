export interface CoincidentMarkGroup<T> {
  coordinate: number;
  members: T[];
}

export interface GroupTokenPlacement {
  x: number;
  side: "left" | "right";
}

const TOKEN_WIDTH = 28;
const TOKEN_GAP = 4;

export function groupCoincidentMarks<T>(
  marks: readonly T[],
  coordinateOf: (mark: T) => number,
): CoincidentMarkGroup<T>[] {
  const byCoordinate = new Map<number, CoincidentMarkGroup<T>>();
  for (const mark of marks) {
    const coordinate = coordinateOf(mark);
    const group = byCoordinate.get(coordinate);
    if (group === undefined) {
      byCoordinate.set(coordinate, { coordinate, members: [mark] });
    } else {
      group.members.push(mark);
    }
  }
  return [...byCoordinate.values()];
}

export function feedCountToken(count: number): string {
  return count <= 99 ? `x${count}` : "x99+";
}

export function placeGroupTokens<T>(
  groups: readonly CoincidentMarkGroup<T>[],
  laneStart: number,
  laneEnd: number,
): Map<number, GroupTokenPlacement> {
  const placements = new Map<number, GroupTokenPlacement>();
  const anchors = groups.map((group) => group.coordinate);
  const reserved: { start: number; end: number }[] = [];

  for (const group of [...groups].sort(
    (left, right) => left.coordinate - right.coordinate,
  )) {
    if (group.members.length < 2) continue;
    const candidates = [
      {
        x: group.coordinate + TOKEN_GAP,
        side: "right" as const,
      },
      {
        x: group.coordinate - TOKEN_GAP - TOKEN_WIDTH,
        side: "left" as const,
      },
    ];
    const placement = candidates.find((candidate) => {
      const interval = { start: candidate.x, end: candidate.x + TOKEN_WIDTH };
      return (
        interval.start >= laneStart &&
        interval.end <= laneEnd &&
        !anchors.some(
          (anchor) =>
            anchor !== group.coordinate &&
            anchor >= interval.start &&
            anchor <= interval.end,
        ) &&
        !reserved.some(
          (used) => interval.start < used.end && interval.end > used.start,
        )
      );
    });
    if (placement !== undefined) {
      placements.set(group.coordinate, placement);
      reserved.push({
        start: placement.x,
        end: placement.x + TOKEN_WIDTH,
      });
    }
  }

  return placements;
}
