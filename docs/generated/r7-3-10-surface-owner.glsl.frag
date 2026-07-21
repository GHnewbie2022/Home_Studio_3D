// === GENERATED: surface-owner BEGIN  (registry 65d86f861d613145) ===
// Source of truth: docs/data/r7-3-10-surface-owner-registry.json
// Generator     : docs/tools/r7-3-10-surface-owner-codegen.mjs  (DO NOT hand-edit this block)
const int R7310_OWNER_NONE = 0;
const int R7310_OWNER_CEILING_OPEN = 1;
const int R7310_OWNER_SOUTH_WALL = 2;
const int R7310_OWNER_SOUTH_WALL_DEPTH_TOP = 3;
const int R7310_OWNER_SOUTH_WINDOW_TOP_REVEAL_DEPTH = 4;
const int R7310_OWNER_SOUTH_WINDOW_TOP_REVEAL_FRONT = 5;
const int R7310_OWNER_SOUTH_WINDOW_LEFT_REVEAL = 6;
const int R7310_OWNER_SOUTH_WINDOW_RIGHT_REVEAL = 7;
const int R7310_OWNER_SOUTH_WINDOW_BOTTOM_REVEAL = 8;
const int R7310_OWNER_FLOOR_OPEN = 9;
const int R7310_OWNER_CENTRAL_DESK_TOP = 10;
const int R7310_OWNER_CENTRAL_DESK_FRONT = 11;
const int R7310_OWNER_CENTRAL_DESK_BACK = 12;
const int R7310_OWNER_CENTRAL_DESK_LEFT = 13;
const int R7310_OWNER_CENTRAL_DESK_RIGHT = 14;
const int R7310_OWNER_SOUTH_SYSTEM_DESK_TOP = 15;
const int R7310_OWNER_SOUTH_SYSTEM_DESK_UNDERSIDE = 16;
const int R7310_OWNER_SOUTH_SYSTEM_DESK_NORTH = 17;
const int R7310_OWNER_SOUTH_SYSTEM_DESK_EAST_EXPOSED = 18;
const int R7310_OWNER_SOUTHWEST_DRAWER_NORTH_1 = 19;
const int R7310_OWNER_SOUTHWEST_DRAWER_NORTH_2 = 20;
const int R7310_OWNER_SOUTHWEST_DRAWER_NORTH_3 = 21;
const int R7310_OWNER_SOUTHWEST_DRAWER_NORTH_4 = 22;
const int R7310_OWNER_SOUTHWEST_DRAWER_EAST_1 = 23;
const int R7310_OWNER_SOUTHWEST_DRAWER_EAST_2 = 24;
const int R7310_OWNER_SOUTHWEST_DRAWER_EAST_3 = 25;
const int R7310_OWNER_SOUTHWEST_DRAWER_EAST_4 = 26;
const int R7310_OWNER_SOUTHEAST_BOOKSHELF_TOP = 27;
const int R7310_OWNER_SOUTHEAST_BOOKSHELF_NORTH = 28;
const int R7310_OWNER_SOUTHEAST_BOOKSHELF_WEST_LOWER_BELOW_OUTLET = 29;
const int R7310_OWNER_SOUTHEAST_BOOKSHELF_WEST_LOWER_ABOVE_OUTLET = 30;
const int R7310_OWNER_SOUTHEAST_BOOKSHELF_WEST_LOWER_NORTH_OF_OUTLET = 31;
const int R7310_OWNER_SOUTHEAST_BOOKSHELF_WEST_LOWER_SOUTH_OF_OUTLET = 32;
const int R7310_OWNER_SOUTHEAST_BOOKSHELF_WEST_UPPER = 33;
const int R7310_OWNER_NORTHEAST_BED_TOP = 34;
const int R7310_OWNER_NORTHEAST_BED_SOUTH = 35;
const int R7310_OWNER_NORTHEAST_BED_WEST = 36;
const int R7310_OWNER_WEST_WALL_SWITCH_PLATE = 37;
const int R7310_OWNER_WEST_WALL_SWITCH_BUTTON = 38;
const int R7310_OWNER_WEST_WALL_OPEN = 39;
const int R7310_OWNER_WEST_THRESHOLD_FRONT = 40;
const int R7310_OWNER_WEST_THRESHOLD_TOP = 41;
bool r7310SurfaceOwnerIsPending(int ownerId) {
	return false;
}
// highest-precedence matching owner; 0 if none. Mirrors registry ownerOfSurface().
int r7310SurfaceOwnerId(vec3 p, vec3 n, float objId) {
	int best = R7310_OWNER_NONE;
	int bestPrec = -2147483647;
	// ceiling_open (precedence 10)
	if (n.y * -1.0 > 0.5 && objId < 1.5 && p.y >= 2.895 && p.y <= 2.915 && p.z >= -2.074 && p.z <= 3.256 && p.x >= -2.11 && p.x <= 2.11) { if (10 > bestPrec) { bestPrec = 10; best = R7310_OWNER_CEILING_OPEN; } }
	// south_wall (precedence 10)
	if (n.z * -1.0 > 0.5 && objId < 1.5 && p.y >= 0.0 && p.y <= 2.905 && p.z >= 3.05 && p.z <= 3.07 && p.x >= -2.11 && p.x <= 2.11) { if (10 > bestPrec) { bestPrec = 10; best = R7310_OWNER_SOUTH_WALL; } }
	// south_wall_depth_top (precedence 20)
	if (n.y * -1.0 > 0.5 && objId < 1.5 && p.y >= 2.895 && p.y <= 2.915 && p.z >= 3.056 && p.z <= 3.256 && ((p.x >= -2.11 && p.x <= -1.75) || (p.x >= 0.69 && p.x <= 2.11))) { if (20 > bestPrec) { bestPrec = 20; best = R7310_OWNER_SOUTH_WALL_DEPTH_TOP; } }
	// south_window_top_reveal_depth (precedence 21)
	if (n.y * -1.0 > 0.5 && objId < 1.5 && p.y >= 2.895 && p.y <= 2.915 && p.z >= 3.056 && p.z <= 3.256 && p.x >= -1.75 && p.x <= 0.69) { if (21 > bestPrec) { bestPrec = 21; best = R7310_OWNER_SOUTH_WINDOW_TOP_REVEAL_DEPTH; } }
	// south_window_top_reveal_front (precedence 15)
	if (n.z * -1.0 > 0.5 && objId < 1.5 && p.y >= 1.04 && p.y <= 2.905 && p.z >= 3.05 && p.z <= 3.07 && p.x >= -1.75 && p.x <= 0.69) { if (15 > bestPrec) { bestPrec = 15; best = R7310_OWNER_SOUTH_WINDOW_TOP_REVEAL_FRONT; } }
	// south_window_left_reveal (precedence 22)
	if (n.x * 1.0 > 0.5 && objId < 1.5 && p.y >= 1.04 && p.y <= 2.905 && p.z >= 3.056 && p.z <= 3.256 && p.x >= -1.76 && p.x <= -1.74) { if (22 > bestPrec) { bestPrec = 22; best = R7310_OWNER_SOUTH_WINDOW_LEFT_REVEAL; } }
	// south_window_right_reveal (precedence 22)
	if (n.x * -1.0 > 0.5 && objId < 1.5 && p.y >= 1.04 && p.y <= 2.905 && p.z >= 3.056 && p.z <= 3.256 && p.x >= 0.68 && p.x <= 0.7) { if (22 > bestPrec) { bestPrec = 22; best = R7310_OWNER_SOUTH_WINDOW_RIGHT_REVEAL; } }
	// south_window_bottom_reveal (precedence 22)
	if (n.y * 1.0 > 0.5 && objId < 1.5 && p.y >= 1.03 && p.y <= 1.05 && p.z >= 3.056 && p.z <= 3.256 && p.x >= -1.75 && p.x <= 0.69) { if (22 > bestPrec) { bestPrec = 22; best = R7310_OWNER_SOUTH_WINDOW_BOTTOM_REVEAL; } }
	// floor_open (precedence 10)
	if (n.y * 1.0 > 0.5 && objId < 1.5 && p.y >= -0.0005 && p.y <= 0.025 && p.z >= -2.074 && p.z <= 3.256 && p.x >= -2.11 && p.x <= 2.11) { if (10 > bestPrec) { bestPrec = 10; best = R7310_OWNER_FLOOR_OPEN; } }
	// central_desk_top (precedence 40)
	if (n.y * 1.0 > 0.5 && p.y >= 0.747 && p.y <= 0.767 && p.z >= 0.405 && p.z <= 0.945 && p.x >= -0.6 && p.x <= 0.6) { if (40 > bestPrec) { bestPrec = 40; best = R7310_OWNER_CENTRAL_DESK_TOP; } }
	// central_desk_front (precedence 40)
	if (n.z * -1.0 > 0.5 && p.y >= 0.0 && p.y <= 0.757 && p.z >= 0.395 && p.z <= 0.415 && p.x >= -0.6 && p.x <= 0.6) { if (40 > bestPrec) { bestPrec = 40; best = R7310_OWNER_CENTRAL_DESK_FRONT; } }
	// central_desk_back (precedence 40)
	if (n.z * 1.0 > 0.5 && p.y >= 0.0 && p.y <= 0.757 && p.z >= 0.935 && p.z <= 0.955 && p.x >= -0.6 && p.x <= 0.6) { if (40 > bestPrec) { bestPrec = 40; best = R7310_OWNER_CENTRAL_DESK_BACK; } }
	// central_desk_left (precedence 40)
	if (n.x * -1.0 > 0.5 && p.y >= 0.0 && p.y <= 0.757 && p.z >= 0.405 && p.z <= 0.945 && p.x >= -0.61 && p.x <= -0.59) { if (40 > bestPrec) { bestPrec = 40; best = R7310_OWNER_CENTRAL_DESK_LEFT; } }
	// central_desk_right (precedence 40)
	if (n.x * 1.0 > 0.5 && p.y >= 0.0 && p.y <= 0.757 && p.z >= 0.405 && p.z <= 0.945 && p.x >= 0.59 && p.x <= 0.61) { if (40 > bestPrec) { bestPrec = 40; best = R7310_OWNER_CENTRAL_DESK_RIGHT; } }
	// south_system_desk_top (precedence 40)
	if (n.y * 1.0 > 0.5 && ((p.x >= -1.75 && p.x <= 1.02 && p.y >= 0.76 && p.y <= 0.78 && p.z >= 2.385 && p.z <= 3.056) || (p.x >= -1.91 && p.x <= -1.75 && p.y >= 0.76 && p.y <= 0.78 && p.z >= 2.385 && p.z <= 2.846))) { if (40 > bestPrec) { bestPrec = 40; best = R7310_OWNER_SOUTH_SYSTEM_DESK_TOP; } }
	// south_system_desk_underside (precedence 40)
	if (n.y * -1.0 > 0.5 && p.y >= 0.62 && p.y <= 0.64 && p.z >= 2.385 && p.z <= 3.056 && p.x >= -1.035 && p.x <= 1.02) { if (40 > bestPrec) { bestPrec = 40; best = R7310_OWNER_SOUTH_SYSTEM_DESK_UNDERSIDE; } }
	// south_system_desk_north (precedence 40)
	if (n.z * -1.0 > 0.5 && p.y >= 0.63 && p.y <= 0.77 && p.z >= 2.375 && p.z <= 2.395 && p.x >= -1.91 && p.x <= 1.02) { if (40 > bestPrec) { bestPrec = 40; best = R7310_OWNER_SOUTH_SYSTEM_DESK_NORTH; } }
	// south_system_desk_east_exposed (precedence 40)
	if (n.x * 1.0 > 0.5 && p.y >= 0.63 && p.y <= 0.77 && p.z >= 2.385 && p.z <= 2.73 && p.x >= 1.01 && p.x <= 1.03) { if (40 > bestPrec) { bestPrec = 40; best = R7310_OWNER_SOUTH_SYSTEM_DESK_EAST_EXPOSED; } }
	// southwest_drawer_north_1 (precedence 40)
	if (n.z * -1.0 > 0.5 && p.y >= 0.0025 && p.y <= 0.155 && p.z >= 2.375 && p.z <= 2.395 && p.x >= -1.91 && p.x <= -1.035) { if (40 > bestPrec) { bestPrec = 40; best = R7310_OWNER_SOUTHWEST_DRAWER_NORTH_1; } }
	// southwest_drawer_north_2 (precedence 40)
	if (n.z * -1.0 > 0.5 && p.y >= 0.16 && p.y <= 0.3125 && p.z >= 2.375 && p.z <= 2.395 && p.x >= -1.91 && p.x <= -1.035) { if (40 > bestPrec) { bestPrec = 40; best = R7310_OWNER_SOUTHWEST_DRAWER_NORTH_2; } }
	// southwest_drawer_north_3 (precedence 40)
	if (n.z * -1.0 > 0.5 && p.y >= 0.3175 && p.y <= 0.47 && p.z >= 2.375 && p.z <= 2.395 && p.x >= -1.91 && p.x <= -1.035) { if (40 > bestPrec) { bestPrec = 40; best = R7310_OWNER_SOUTHWEST_DRAWER_NORTH_3; } }
	// southwest_drawer_north_4 (precedence 40)
	if (n.z * -1.0 > 0.5 && p.y >= 0.475 && p.y <= 0.6275 && p.z >= 2.375 && p.z <= 2.395 && p.x >= -1.91 && p.x <= -1.035) { if (40 > bestPrec) { bestPrec = 40; best = R7310_OWNER_SOUTHWEST_DRAWER_NORTH_4; } }
	// southwest_drawer_east_1 (precedence 40)
	if (n.x * 1.0 > 0.5 && p.y >= 0.0025 && p.y <= 0.155 && p.z >= 2.385 && p.z <= 3.056 && p.x >= -1.045 && p.x <= -1.025) { if (40 > bestPrec) { bestPrec = 40; best = R7310_OWNER_SOUTHWEST_DRAWER_EAST_1; } }
	// southwest_drawer_east_2 (precedence 40)
	if (n.x * 1.0 > 0.5 && p.y >= 0.16 && p.y <= 0.3125 && p.z >= 2.385 && p.z <= 3.056 && p.x >= -1.045 && p.x <= -1.025) { if (40 > bestPrec) { bestPrec = 40; best = R7310_OWNER_SOUTHWEST_DRAWER_EAST_2; } }
	// southwest_drawer_east_3 (precedence 40)
	if (n.x * 1.0 > 0.5 && p.y >= 0.3175 && p.y <= 0.47 && p.z >= 2.385 && p.z <= 3.056 && p.x >= -1.045 && p.x <= -1.025) { if (40 > bestPrec) { bestPrec = 40; best = R7310_OWNER_SOUTHWEST_DRAWER_EAST_3; } }
	// southwest_drawer_east_4 (precedence 40)
	if (n.x * 1.0 > 0.5 && p.y >= 0.475 && p.y <= 0.6275 && p.z >= 2.385 && p.z <= 3.056 && p.x >= -1.045 && p.x <= -1.025) { if (40 > bestPrec) { bestPrec = 40; best = R7310_OWNER_SOUTHWEST_DRAWER_EAST_4; } }
	// southeast_bookshelf_top (precedence 40)
	if (n.y * 1.0 > 0.5 && p.y >= 2.03 && p.y <= 2.05 && p.z >= 2.73 && p.z <= 3.056 && p.x >= 1.02 && p.x <= 1.78) { if (40 > bestPrec) { bestPrec = 40; best = R7310_OWNER_SOUTHEAST_BOOKSHELF_TOP; } }
	// southeast_bookshelf_north (precedence 40)
	if (n.z * -1.0 > 0.5 && p.y >= 0.0 && p.y <= 2.04 && p.z >= 2.72 && p.z <= 2.74 && p.x >= 1.02 && p.x <= 1.78) { if (40 > bestPrec) { bestPrec = 40; best = R7310_OWNER_SOUTHEAST_BOOKSHELF_NORTH; } }
	// southeast_bookshelf_west_lower_below_outlet (precedence 40)
	if (n.x * -1.0 > 0.5 && p.y >= 0.0 && p.y <= 0.355 && p.z >= 2.73 && p.z <= 3.056 && p.x >= 1.01 && p.x <= 1.03) { if (40 > bestPrec) { bestPrec = 40; best = R7310_OWNER_SOUTHEAST_BOOKSHELF_WEST_LOWER_BELOW_OUTLET; } }
	// southeast_bookshelf_west_lower_above_outlet (precedence 40)
	if (n.x * -1.0 > 0.5 && p.y >= 0.475 && p.y <= 0.63 && p.z >= 2.73 && p.z <= 3.056 && p.x >= 1.01 && p.x <= 1.03) { if (40 > bestPrec) { bestPrec = 40; best = R7310_OWNER_SOUTHEAST_BOOKSHELF_WEST_LOWER_ABOVE_OUTLET; } }
	// southeast_bookshelf_west_lower_north_of_outlet (precedence 40)
	if (n.x * -1.0 > 0.5 && p.y >= 0.355 && p.y <= 0.475 && p.z >= 2.73 && p.z <= 2.906 && p.x >= 1.01 && p.x <= 1.03) { if (40 > bestPrec) { bestPrec = 40; best = R7310_OWNER_SOUTHEAST_BOOKSHELF_WEST_LOWER_NORTH_OF_OUTLET; } }
	// southeast_bookshelf_west_lower_south_of_outlet (precedence 40)
	if (n.x * -1.0 > 0.5 && p.y >= 0.355 && p.y <= 0.475 && p.z >= 3.026 && p.z <= 3.056 && p.x >= 1.01 && p.x <= 1.03) { if (40 > bestPrec) { bestPrec = 40; best = R7310_OWNER_SOUTHEAST_BOOKSHELF_WEST_LOWER_SOUTH_OF_OUTLET; } }
	// southeast_bookshelf_west_upper (precedence 40)
	if (n.x * -1.0 > 0.5 && p.y >= 0.77 && p.y <= 2.04 && p.z >= 2.73 && p.z <= 3.056 && p.x >= 1.01 && p.x <= 1.03) { if (40 > bestPrec) { bestPrec = 40; best = R7310_OWNER_SOUTHEAST_BOOKSHELF_WEST_UPPER; } }
	// northeast_bed_top (precedence 40)
	if (n.y * 1.0 > 0.5 && p.y >= 0.27 && p.y <= 0.29 && p.z >= -1.874 && p.z <= -0.314 && p.x >= -0.027 && p.x <= 1.91) { if (40 > bestPrec) { bestPrec = 40; best = R7310_OWNER_NORTHEAST_BED_TOP; } }
	// northeast_bed_south (precedence 40)
	if (n.z * 1.0 > 0.5 && p.y >= 0.0 && p.y <= 0.28 && p.z >= -0.324 && p.z <= -0.304 && p.x >= -0.027 && p.x <= 1.91) { if (40 > bestPrec) { bestPrec = 40; best = R7310_OWNER_NORTHEAST_BED_SOUTH; } }
	// northeast_bed_west (precedence 40)
	if (n.x * -1.0 > 0.5 && p.y >= 0.0 && p.y <= 0.28 && p.z >= -1.874 && p.z <= -0.314 && p.x >= -0.037 && p.x <= -0.017) { if (40 > bestPrec) { bestPrec = 40; best = R7310_OWNER_NORTHEAST_BED_WEST; } }
	// west_wall_switch_plate (precedence 50)
	if (n.x * 1.0 > 0.5 && p.y >= 1.148 && p.y <= 1.218 && p.z >= -0.089 && p.z <= 0.031 && p.x >= -1.901 && p.x <= -1.899) { if (50 > bestPrec) { bestPrec = 50; best = R7310_OWNER_WEST_WALL_SWITCH_PLATE; } }
	// west_wall_switch_button (precedence 51)
	if (n.x * 1.0 > 0.5 && p.y >= 1.161 && p.y <= 1.205 && p.z >= -0.076 && p.z <= 0.018 && p.x >= -1.899 && p.x <= -1.897) { if (51 > bestPrec) { bestPrec = 51; best = R7310_OWNER_WEST_WALL_SWITCH_BUTTON; } }
	// west_wall_open (precedence 10)
	if (n.x * 1.0 > 0.5 && objId < 1.5 && p.y >= 0.0 && p.y <= 2.905 && p.z >= -1.874 && p.z <= 3.056 && p.x >= -1.92 && p.x <= -1.9) { if (10 > bestPrec) { bestPrec = 10; best = R7310_OWNER_WEST_WALL_OPEN; } }
	// west_threshold_front (precedence 31)
	if (n.x * 1.0 > 0.5 && p.y >= 0.0 && p.y <= 0.095 && p.z >= -1.874 && p.z <= -0.984 && p.x >= -1.92 && p.x <= -1.9) { if (31 > bestPrec) { bestPrec = 31; best = R7310_OWNER_WEST_THRESHOLD_FRONT; } }
	// west_threshold_top (precedence 30)
	if (n.y * 1.0 > 0.5 && p.y >= 0.085 && p.y <= 0.095 && p.z >= -1.874 && p.z <= -0.984 && p.x >= -2.11 && p.x <= -1.91) { if (30 > bestPrec) { bestPrec = 30; best = R7310_OWNER_WEST_THRESHOLD_TOP; } }
	return best;
}
// Convenience owner gate: true only where the open ceiling is the rightful owner.
bool r7310SurfaceOwnerIsCeilingOpen(vec3 p, vec3 n, float objId) {
	return r7310SurfaceOwnerId(p, n, objId) == R7310_OWNER_CEILING_OPEN;
}
// === GENERATED: surface-owner END ===
