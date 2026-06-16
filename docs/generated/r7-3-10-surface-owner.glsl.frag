// === GENERATED: surface-owner BEGIN  (registry fc176523994dd58b) ===
// Source of truth: docs/data/r7-3-10-surface-owner-registry.json
// Generator     : docs/tools/r7-3-10-surface-owner-codegen.mjs  (DO NOT hand-edit this block)
const int R7310_OWNER_NONE = 0;
const int R7310_OWNER_CEILING_OPEN = 1;
const int R7310_OWNER_SOUTH_WALL = 2;
const int R7310_OWNER_SOUTH_WALL_DEPTH_TOP = 3;
const int R7310_OWNER_SOUTH_WINDOW_TOP_REVEAL_DEPTH = 4;
const int R7310_OWNER_SOUTH_WINDOW_TOP_REVEAL_FRONT = 5;
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
	return best;
}
// Convenience owner gate: true only where the open ceiling is the rightful owner.
bool r7310SurfaceOwnerIsCeilingOpen(vec3 p, vec3 n, float objId) {
	return r7310SurfaceOwnerId(p, n, objId) == R7310_OWNER_CEILING_OPEN;
}
// === GENERATED: surface-owner END ===
