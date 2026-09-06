/**
 * 规则内核单元测试 —— 零依赖，运行：npm test 或 node --test tests/
 * 覆盖：开局摆法、车/马/象/炮/兵走子、蹩马腿/塞象眼/炮架、九宫与白脸将、
 *       将军判定、合法着法枚举、中文记谱、FEN、UCI 互逆。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
    createInitialBoard, cloneBoard, canMoveRaw, simulateMove, getAllValid,
    getAllLegalMoves, isInCheck, isKingFaceToFace, findKing,
    buildNotation, boardToFEN, parsePikafishMove, moveToUci, getPieceName
} from '../docs/js/rules.js';

const E = () => ({ side: 0, id: 0 });
// 构造空棋盘，再按 [side,id] 放置若干子
function boardWith(pieces) {
    const b = [];
    for (let r = 0; r < 10; r++) {
        b.push([]);
        for (let c = 0; c < 9; c++) b[r].push(E());
    }
    for (const [r, c, side, id] of pieces) b[r][c] = { side, id };
    return b;
}

test('初始棋盘：10x9，双方将帅就位，初始 FEN 符合中国象棋标准', () => {
    const b = createInitialBoard();
    assert.equal(b.length, 10);
    b.forEach((row) => assert.equal(row.length, 9));
    assert.deepEqual(findKing(b, 1), { r: 0, c: 4 });
    assert.deepEqual(findKing(b, 2), { r: 9, c: 4 });
    assert.equal(
        boardToFEN(b, true),
        'rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR w - - 0 1'
    );
});

test('初始局面：红方合法着法数量确定且双方对称', () => {
    const b = createInitialBoard();
    const red = getAllLegalMoves(b, 2);
    const black = getAllLegalMoves(b, 1);
    assert.ok(red.length >= 40 && red.length <= 46, `开局着法数异常: ${red.length}`);
    assert.equal(red.length, black.length, '对称开局双方着法数应相等');
    // 确定性：同一局面重复计算结果一致
    assert.equal(getAllLegalMoves(cloneBoard(b), 2).length, red.length);
});

test('车：直线通行、不能越子、可吃敌子不可吃己子', () => {
    const b = boardWith([
        [5, 0, 2, 1],   // 红车
        [5, 4, 1, 1],   // 黑车（敌子，可吃）
        [5, 1, 2, 7]    // 红兵（己子，挡路）
    ]);
    assert.ok(canMoveRaw(b, 5, 0, 5, 1) === false, '不能吃己方兵');
    assert.ok(canMoveRaw(b, 5, 0, 4, 0), '可向上直行');
    // 兵在 c1 挡住，无法到达 c2/c4
    assert.ok(!canMoveRaw(b, 5, 0, 5, 2), '被己子挡住不能越过');
    const b2 = boardWith([[5, 0, 2, 1], [5, 4, 1, 1]]);
    assert.ok(canMoveRaw(b2, 5, 0, 5, 4), '同一行无遮挡可吃敌子');
    assert.ok(!canMoveRaw(b2, 5, 0, 4, 1), '车不能斜走');
});

test('马：走日字且蹩马腿', () => {
    const b = boardWith([[5, 4, 2, 2]]); // 单马
    assert.ok(canMoveRaw(b, 5, 4, 3, 3), '马走日合法');   // dr-2 dc-1
    assert.ok(canMoveRaw(b, 5, 4, 4, 2), '马走日合法');   // dr-1 dc-2
    assert.ok(!canMoveRaw(b, 5, 4, 3, 4), '非日字不合法'); // dr-2 dc0
    // 在马腿上放一子 -> 向上的两个点被蹩
    const b2 = boardWith([[5, 4, 2, 2], [4, 4, 1, 7]]);
    assert.ok(!canMoveRaw(b2, 5, 4, 3, 3), '蹩马腿不能跳');
    assert.ok(!canMoveRaw(b2, 5, 4, 3, 5), '蹩马腿不能跳');
    assert.ok(canMoveRaw(b2, 5, 4, 6, 2), '反方向未蹩腿(dr+1,dc-2 马腿在5,3)仍可跳');
});

test('象/相：走田、塞象眼、不过河', () => {
    const b = boardWith([[9, 2, 2, 3]]); // 红相
    assert.ok(canMoveRaw(b, 9, 2, 7, 0), '相飞田合法');
    assert.ok(canMoveRaw(b, 9, 2, 7, 4), '相飞田合法');
    assert.ok(!canMoveRaw(b, 9, 2, 5, 2), '相不能过河');
    const b2 = boardWith([[9, 2, 2, 3], [8, 3, 1, 7]]); // 塞象眼
    assert.ok(!canMoveRaw(b2, 9, 2, 7, 4), '塞象眼不能飞');
});

test('炮：移动同车，吃子必须恰好一个炮架', () => {
    // 无架：不能吃敌子
    const noScreen = boardWith([[5, 0, 2, 6], [5, 3, 1, 1]]);
    assert.ok(!canMoveRaw(noScreen, 5, 0, 5, 3), '无炮架不能吃');
    assert.ok(canMoveRaw(noScreen, 5, 0, 5, 2), '可移动到空位');
    // 恰好一个炮架：可吃
    const oneScreen = boardWith([[5, 0, 2, 6], [5, 2, 2, 7], [5, 4, 1, 1]]);
    assert.ok(canMoveRaw(oneScreen, 5, 0, 5, 4), '一炮架可翻吃');
    // 两个炮架：不能吃
    const twoScreen = boardWith([[5, 0, 2, 6], [5, 1, 2, 7], [5, 2, 2, 7], [5, 4, 1, 1]]);
    assert.ok(!canMoveRaw(twoScreen, 5, 0, 5, 4), '两炮架不能吃');
});

test('兵/卒：未过河只进，过河可横走不能后退', () => {
    const redPawnBefore = boardWith([[6, 4, 2, 7]]); // 红兵在己方半场
    assert.ok(canMoveRaw(redPawnBefore, 6, 4, 5, 4), '可向前');
    assert.ok(!canMoveRaw(redPawnBefore, 6, 4, 6, 3), '未过河不能横走');
    assert.ok(!canMoveRaw(redPawnBefore, 6, 4, 7, 4), '不能后退');
    const redPawnAfter = boardWith([[4, 4, 2, 7]]); // 过河
    assert.ok(canMoveRaw(redPawnAfter, 4, 4, 3, 4), '过河继续向前');
    assert.ok(canMoveRaw(redPawnAfter, 4, 4, 4, 3), '过河可横走');
});

test('将/帅：限九宫直走一步', () => {
    const b = boardWith([[9, 4, 2, 5]]);
    assert.ok(canMoveRaw(b, 9, 4, 8, 4), '帅可前进一步');
    assert.ok(!canMoveRaw(b, 9, 4, 7, 4), '帅不能走两步');
    assert.ok(!canMoveRaw(b, 9, 4, 8, 3), '帅不能斜走');
    const b2 = boardWith([[9, 3, 2, 5]]);
    assert.ok(!canMoveRaw(b2, 9, 3, 8, 2), '帅不能走出九宫');
});

test('白脸将：双帅同列无遮挡为非法，simulateMove 会拒绝造成照面的走法', () => {
    const face = boardWith([[0, 4, 1, 5], [9, 4, 2, 5]]);
    assert.ok(isKingFaceToFace(face), '同列无子应判将帅照面');
    const blocked = boardWith([[0, 4, 1, 5], [5, 4, 2, 6], [9, 4, 2, 5]]);
    assert.ok(!isKingFaceToFace(blocked), '中间有子不算照面');
    // 红帅在(9,4)，红车在(9,0)想横走到(9,3)不影响；构造一个会移开遮挡导致照面的走法
    const b = boardWith([[0, 4, 1, 5], [5, 4, 2, 6], [9, 4, 2, 5]]);
    assert.ok(!simulateMove(b, 5, 4, 5, 3), '炮闪开导致将帅照面，应判非法');
    assert.equal(b[5][4].id, 6, 'simulateMove 不得修改入参棋盘');
});

test('将军判定：车正对无遮挡将军，isInCheck 为真', () => {
    const b = boardWith([
        [0, 4, 1, 5], // 黑将
        [5, 4, 2, 1], // 红车同列将军
        [9, 4, 2, 5]  // 红帅
    ]);
    assert.ok(isInCheck(b, 1), '黑将应被红车将军');
    const b2 = boardWith([
        [0, 4, 1, 5],
        [5, 3, 2, 1], // 红车错开一列，不将军
        [9, 4, 2, 5]
    ]);
    assert.ok(!isInCheck(b2, 1), '错开列不将军');
});

test('不能送将：走完让自己被将的着法非法', () => {
    // 黑车在(0,0)沿列0；红帅(9,4)无关，构造红车去挡又离开的简化：
    // 红帅(9,4)，黑车(5,4)将军中，红方任何不能解除将军的走法都非法。
    const b = boardWith([
        [9, 4, 2, 5],
        [5, 4, 1, 1], // 黑车将军
        [9, 0, 2, 1]  // 红车在左下角，无法一步解将
    ]);
    // 红车沿第9行走到(9,1)，仍没挡住列4，红帅依旧被将 -> 非法
    assert.ok(!simulateMove(b, 9, 0, 9, 1), '无法解将的着法应非法');
    // 未被将军时，同类闲走应合法（黑车错开一列不将军）
    const b2 = boardWith([
        [9, 4, 2, 5],
        [5, 3, 1, 1],
        [9, 0, 2, 1]
    ]);
    assert.ok(simulateMove(b2, 9, 0, 9, 1), '未被将军时闲走合法');
});

test('中文记谱：中炮=炮二平五，马二进三', () => {
    const b = createInitialBoard();
    // 右手红炮 (7,7) 平到中路 (7,4) -> 炮二平五
    assert.equal(buildNotation(b, 7, 7, 7, 4), '炮二平五');
    // 红马 (9,7) 跳到 (7,6) -> 马二进三
    assert.equal(buildNotation(b, 9, 7, 7, 6), '马二进三');
    // 黑方8路炮 (2,7) 平中 (2,4) -> 炮8平5（黑列号用阿拉伯数字，从自己右手数）
    assert.equal(buildNotation(b, 2, 7, 2, 4), '炮8平5');
    // 黑方2路炮 (2,1) 平中 -> 炮2平5
    assert.equal(buildNotation(b, 2, 1, 2, 4), '炮2平5');
});

test('棋子名：区分象/相、将/帅、兵/卒', () => {
    assert.equal(getPieceName(1, 3), '象');
    assert.equal(getPieceName(2, 3), '相');
    assert.equal(getPieceName(1, 5), '将');
    assert.equal(getPieceName(2, 5), '帅');
    assert.equal(getPieceName(1, 7), '卒');
    assert.equal(getPieceName(2, 7), '兵');
});

test('UCI 互逆：moveToUci 与 parsePikafishMove 互为逆运算', () => {
    const cases = [[7, 7, 7, 4], [9, 7, 7, 6], [2, 1, 2, 4], [0, 0, 9, 8]];
    for (const [sr, sc, tr, tc] of cases) {
        const uci = moveToUci(sr, sc, tr, tc);
        const back = parsePikafishMove(uci);
        assert.deepEqual(back, { sr, sc, tr, tc }, `互逆失败: ${uci}`);
    }
    // 已知映射：棋盘(9,7)红底线 -> UCI 列h、行0；目标(7,6)->列g、行2 => h0g2
    assert.equal(moveToUci(9, 7, 7, 6), 'h0g2');
});
