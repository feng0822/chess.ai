/**
 * 中国象棋 · 纯规则内核（ES Module）
 * ------------------------------------------------------------------
 * 这一层只做“棋盘规则 / 中文记谱 / FEN”，特点：
 *   1. 零 DOM、零全局可变状态——所有判断都通过第一个参数 board 显式传入；
 *   2. 纯函数：不修改传入的 board（试走在内部副本上进行）；
 *   3. 浏览器与 Node 同一份代码，因此可以用 node:test 直接做单元测试。
 *
 * 棋盘约定（与 index.html 完全一致）：
 *   board[r][c] = { side, id }；r0=黑方底线，r9=红方底线；c0..c8 从左到右。
 *   side: 0=空, 1=黑, 2=红；id: 0空 1车 2马 3象/相 4士/仕 5将/帅 6炮 7兵/卒。
 */

// 中式记谱用到的中文数字
export const CN_NUM = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'];

// 标准开局摆法（与页面初始布局保持同一事实来源）
export function createInitialBoard() {
    const E = () => ({ side: 0, id: 0 });
    const row = (cells) => {
        const r = [];
        for (let c = 0; c < 9; c++) r.push(cells[c] || E());
        return r;
    };
    const B = (id) => ({ side: 1, id }); // 黑子
    const R = (id) => ({ side: 2, id }); // 红子
    return [
        row([B(1), B(2), B(3), B(4), B(5), B(4), B(3), B(2), B(1)]),
        row([E(), E(), E(), E(), E(), E(), E(), E(), E()]),
        row([E(), B(6), E(), E(), E(), E(), E(), B(6), E()]),
        row([B(7), E(), B(7), E(), B(7), E(), B(7), E(), B(7)]),
        row([E(), E(), E(), E(), E(), E(), E(), E(), E()]),
        row([E(), E(), E(), E(), E(), E(), E(), E(), E()]),
        row([R(7), E(), R(7), E(), R(7), E(), R(7), E(), R(7)]),
        row([E(), R(6), E(), E(), E(), E(), E(), R(6), E()]),
        row([E(), E(), E(), E(), E(), E(), E(), E(), E()]),
        row([R(1), R(2), R(3), R(4), R(5), R(4), R(3), R(2), R(1)])
    ];
}

export function cloneBoard(board) {
    return board.map((rowArr) => rowArr.map((p) => ({ side: p.side, id: p.id })));
}

export function inBoard(r, c) {
    return r >= 0 && r <= 9 && c >= 0 && c <= 8;
}

// 统计同一行/列上，起点与终点之间的棋子数（用于车/炮/将帅照面）
export function countBlock(board, sr, sc, tr, tc) {
    let cnt = 0;
    if (sr === tr) {
        const minc = Math.min(sc, tc), maxc = Math.max(sc, tc);
        for (let c = minc + 1; c < maxc; c++) {
            if (board[sr][c].id !== 0) cnt++;
        }
    } else if (sc === tc) {
        const minr = Math.min(sr, tr), maxr = Math.max(sr, tr);
        for (let r = minr + 1; r < maxr; r++) {
            if (board[r][sc].id !== 0) cnt++;
        }
    }
    return cnt;
}

// 不考虑“走完后自己是否被将”的基础走子规则（蹩马腿/塞象眼/炮架等都在此）
export function canMoveRaw(board, sr, sc, tr, tc) {
    if (!inBoard(tr, tc)) return false;
    const s = board[sr][sc];
    const t = board[tr][tc];
    if (s.id === 0) return false;
    if (t.id !== 0 && t.side === s.side) return false;
    const id = s.id;
    const side = s.side;

    if (id === 1) { // 车：直线且中间无子
        if (sr !== tr && sc !== tc) return false;
        return countBlock(board, sr, sc, tr, tc) === 0;
    }
    if (id === 2) { // 马：日字且不蹩马腿
        const dr = tr - sr;
        const dc = tc - sc;
        let ok = false, blockR, blockC;
        if (dr === -2 && dc === -1) { ok = true; blockR = sr - 1; blockC = sc; }
        else if (dr === -2 && dc === 1) { ok = true; blockR = sr - 1; blockC = sc; }
        else if (dr === -1 && dc === -2) { ok = true; blockR = sr; blockC = sc - 1; }
        else if (dr === -1 && dc === 2) { ok = true; blockR = sr; blockC = sc + 1; }
        else if (dr === 1 && dc === -2) { ok = true; blockR = sr; blockC = sc - 1; }
        else if (dr === 1 && dc === 2) { ok = true; blockR = sr; blockC = sc + 1; }
        else if (dr === 2 && dc === -1) { ok = true; blockR = sr + 1; blockC = sc; }
        else if (dr === 2 && dc === 1) { ok = true; blockR = sr + 1; blockC = sc; }
        if (!ok) return false;
        return board[blockR][blockC].id === 0;
    }
    if (id === 3) { // 象/相：田字、不塞象眼、不过河
        const dr = Math.abs(tr - sr);
        const dc = Math.abs(tc - sc);
        if (dr !== 2 || dc !== 2) return false;
        const er = (sr + tr) / 2;
        const ec = (sc + tc) / 2;
        if (board[er][ec].id !== 0) return false;
        if (side === 1 && tr > 4) return false;
        if (side === 2 && tr < 5) return false;
        return true;
    }
    if (id === 4) { // 士/仕：九宫内斜走一步
        const dr = Math.abs(tr - sr);
        const dc = Math.abs(tc - sc);
        if (dr !== 1 || dc !== 1) return false;
        if (side === 1) {
            if (tr < 0 || tr > 2 || tc < 3 || tc > 5) return false;
        } else {
            if (tr < 7 || tr > 9 || tc < 3 || tc > 5) return false;
        }
        return true;
    }
    if (id === 5) { // 将/帅：九宫内直走一步
        const dr = Math.abs(tr - sr);
        const dc = Math.abs(tc - sc);
        if (!((dr === 1 && dc === 0) || (dr === 0 && dc === 1))) return false;
        if (side === 1) {
            if (tr < 0 || tr > 2 || tc < 3 || tc > 5) return false;
        } else {
            if (tr < 7 || tr > 9 || tc < 3 || tc > 5) return false;
        }
        return true;
    }
    if (id === 6) { // 炮：移动同车（中间无子）；吃子需恰好一个炮架
        if (sr !== tr && sc !== tc) return false;
        const blk = countBlock(board, sr, sc, tr, tc);
        if (t.id === 0) return blk === 0;
        return blk === 1;
    }
    if (id === 7) { // 兵/卒：未过河只能向前，过河后可平移
        const dr = tr - sr;
        const dc = tc - sc;
        if (side === 1) {
            if (sr <= 4) {
                if (dr !== 1 || dc !== 0) return false;
            } else {
                if (!((dr === 1 && dc === 0) || (dr === 0 && Math.abs(dc) === 1))) return false;
            }
        } else {
            if (sr >= 5) {
                if (dr !== -1 || dc !== 0) return false;
            } else {
                if (!((dr === -1 && dc === 0) || (dr === 0 && Math.abs(dc) === 1))) return false;
            }
        }
        return true;
    }
    return false;
}

export function findKing(board, side) {
    for (let r = 0; r < 10; r++) {
        for (let c = 0; c < 9; c++) {
            if (board[r][c].id === 5 && board[r][c].side === side) return { r, c };
        }
    }
    return null;
}

// 双帅是否在同一列且中间无子（白脸将，规则不允许）
export function isKingFaceToFace(board) {
    const bk = findKing(board, 1);
    const rk = findKing(board, 2);
    if (!bk || !rk) return false;
    if (bk.c !== rk.c) return false;
    return countBlock(board, bk.r, bk.c, rk.r, rk.c) === 0;
}

// 指定一方是否正被将军
export function isInCheck(board, side) {
    const king = findKing(board, side);
    if (!king) return false;
    for (let r = 0; r < 10; r++) {
        for (let c = 0; c < 9; c++) {
            const p = board[r][c];
            if (p.id === 0 || p.side === side) continue;
            if (canMoveRaw(board, r, c, king.r, king.c)) return true;
        }
    }
    return false;
}

// 在内部副本上试走，判断这步是否合法（走完不能将帅照面、不能送将）。不修改入参。
export function simulateMove(board, sr, sc, tr, tc) {
    if (!canMoveRaw(board, sr, sc, tr, tc)) return false;
    const b = cloneBoard(board);
    b[tr][tc] = { ...b[sr][sc] };
    b[sr][sc] = { side: 0, id: 0 };
    const moverSide = b[tr][tc].side;
    if (isKingFaceToFace(b) || isInCheck(b, moverSide)) return false;
    return true;
}

// 某一个棋子的全部合法落点
export function getAllValid(board, sr, sc) {
    const res = [];
    for (let r = 0; r < 10; r++) {
        for (let c = 0; c < 9; c++) {
            if (simulateMove(board, sr, sc, r, c)) res.push({ r, c });
        }
    }
    return res;
}

// 枚举指定一方的全部合法着法
export function getAllLegalMoves(board, side) {
    const moves = [];
    for (let r = 0; r < 10; r++) {
        for (let c = 0; c < 9; c++) {
            const p = board[r][c];
            if (p.id === 0 || p.side !== side) continue;
            for (const m of getAllValid(board, r, c)) {
                moves.push({ sr: r, sc: c, tr: m.r, tc: m.c });
            }
        }
    }
    return moves;
}

// ---------------- 中文记谱 ----------------
export function getPieceName(side, id) {
    if (id === 1) return '车';
    if (id === 2) return '马';
    if (id === 3) return side === 1 ? '象' : '相';
    if (id === 4) return '士';
    if (id === 5) return side === 1 ? '将' : '帅';
    if (id === 6) return '炮';
    if (id === 7) return side === 1 ? '卒' : '兵';
    return '';
}

// 红用中文数字且列从右往左，黑用阿拉伯数字
export function colLabel(c, side) { return side === 2 ? CN_NUM[9 - c] : String(c + 1); }
export function numLabel(n, side) { return side === 2 ? CN_NUM[n] : String(n); }

// 必须在“走子前”的 board 上调用
export function buildNotation(board, sr, sc, tr, tc) {
    const side = board[sr][sc].side, id = board[sr][sc].id;
    const name = getPieceName(side, id);
    const same = [];
    for (let r = 0; r < 10; r++) {
        const p = board[r][sc];
        if (p.id === id && p.side === side) same.push(r);
    }
    let prefix = '';
    if (same.length >= 2) {
        const frontR = side === 2 ? Math.min.apply(null, same) : Math.max.apply(null, same);
        prefix = (sr === frontR) ? '前' : '后';
    }
    const startCol = prefix ? '' : colLabel(sc, side);
    let action, tail, dr = tr - sr;
    if (id === 2 || id === 3 || id === 4) { // 马/象(相)/士(仕) 斜走，只有进退，尾标为目标列
        const forward = side === 2 ? dr < 0 : dr > 0;
        action = forward ? '进' : '退';
        tail = colLabel(tc, side);
    } else if (dr === 0) { // 直线子横走=平
        action = '平'; tail = colLabel(tc, side);
    } else { // 直进/直退，尾标为格数
        const forward = side === 2 ? dr < 0 : dr > 0;
        action = forward ? '进' : '退';
        tail = numLabel(Math.abs(dr), side);
    }
    return prefix + name + startCol + action + tail;
}

// 走子前调用：记录被吃子与中文记谱（此时棋盘未变）
export function preMoveCapture(board, sr, sc, tr, tc) {
    return {
        captured: { ...board[tr][tc] },
        notation: buildNotation(board, sr, sc, tr, tc),
        moverSide: board[sr][sc].side
    };
}

// ---------------- FEN / UCI ----------------
// 棋盘转 FEN（中国象棋 UCI 标准）。turnRed=true 轮到红，写 w。
export function boardToFEN(board, turnRed) {
    const pieceMap = { 1: 'r', 2: 'n', 3: 'b', 4: 'a', 5: 'k', 6: 'c', 7: 'p' };
    let fen = '';
    for (let r = 0; r < 10; r++) {
        let empty = 0;
        for (let c = 0; c < 9; c++) {
            const p = board[r][c];
            if (p.id === 0) { empty++; }
            else {
                if (empty > 0) { fen += empty; empty = 0; }
                let ch = pieceMap[p.id] || '?';
                if (p.side === 2) ch = ch.toUpperCase();
                fen += ch;
            }
        }
        if (empty > 0) fen += empty;
        if (r < 9) fen += '/';
    }
    fen += turnRed ? ' w - - 0 1' : ' b - - 0 1';
    return fen;
}

// 皮卡鱼 UCI 走法（如 "h2e2"）→ 棋盘坐标。UCI 行号从红底线数 0-9，需翻转。
export function parsePikafishMove(moveStr) {
    return {
        sc: moveStr.charCodeAt(0) - 97,
        sr: 9 - parseInt(moveStr[1]),
        tc: moveStr.charCodeAt(2) - 97,
        tr: 9 - parseInt(moveStr[3])
    };
}

// 棋盘坐标 → 皮卡鱼 UCI（parsePikafishMove 的逆运算）
export function moveToUci(sr, sc, tr, tc) {
    return String.fromCharCode(97 + sc) + (9 - sr) + String.fromCharCode(97 + tc) + (9 - tr);
}
