// Eşli okey: seats 0+2 are team 0, seats 1+3 are team 1; the partner sits opposite.
export const TEAM_SEATS = [[0, 2], [1, 3]];
export const teamOf = (seat) => seat % 2;
export const partnerOf = (seat) => (seat + 2) % 4;
