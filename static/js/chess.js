const pieceType = {
    BLACK:1,
    RED:2,
    NONE:0
};
// 标准中国象棋初始布局  r行0~9，c列0~8
const initBoardData = [
    [{side:1,id:1},{side:1,id:2},{side:1,id:3},{side:1,id:4},{side:1,id:5},{side:1,id:4},{side:1,id:3},{side:1,id:2},{side:1,id:1}], // r0黑底线
    [{side:0,id:0},{side:0,id:0},{side:0,id:0},{side:0,id:0},{side:0,id:0},{side:0,id:0},{side:0,id:0},{side:0,id:0},{side:0,id:0}], // r1
    [{side:0,id:0},{side:0,id:0},{side:1,id:6},{side:0,id:0},{side:0,id:0},{side:0,id:0},{side:0,id:0},{side:1,id:6},{side:0,id:0}], // r2【黑炮】
    [{side:1,id:7},{side:0,id:0},{side:1,id:7},{side:0,id:0},{side:1,id:7},{side:0,id:0},{side:1,id:7},{side:0,id:0},{side:1,id:7}], // r3黑卒
    [{side:0,id:0},{side:0,id:0},{side:0,id:0},{side:0,id:0},{side:0,id:0},{side:0,id:0},{side:0,id:0},{side:0,id:0},{side:0,id:0}], // r4
    [{side:0,id:0},{side:0,id:0},{side:0,id:0},{side:0,id:0},{side:0,id:0},{side:0,id:0},{side:0,id:0},{side:0,id:0},{side:0,id:0}], // r5
    [{side:2,id:7},{side:0,id:0},{side:2,id:7},{side:0,id:0},{side:2,id:7},{side:0,id:0},{side:2,id:7},{side:0,id:0},{side:2,id:7}], // r6红兵
    [{side:0,id:0},{side:0,id:0},{side:2,id:6},{side:0,id:0},{side:0,id:0},{side:0,id:0},{side:0,id:0},{side:2,id:6},{side:0,id:0}], // r7【红炮】
    [{side:0,id:0},{side:0,id:0},{side:0,id:0},{side:0,id:0},{side:0,id:0},{side:0,id:0},{side:0,id:0},{side:0,id:0},{side:0,id:0}], // r8
    [{side:2,id:1},{side:2,id:2},{side:2,id:3},{side:2,id:4},{side:2,id:5},{side:2,id:4},{side:2,id:3},{side:2,id:2},{side:2,id:1}]  // r9红底线
];
const idToName = {
    1:"车",2:"马",3:"象",4:"士",5:"将",6:"炮",7:"卒",0:""
};

let board = JSON.parse(JSON.stringify(initBoardData));
let selected=null;
let turnRed=true;
const boardDom=document.getElementById("board");
const cell=55;
const ox=30,oy=30;

function drawBoardLines(){
    //横线
    for(let i=0;i<10;i++){
        const d=document.createElement("div");
        d.className="h-line";
        d.style.top=oy+i*cell+"px";
        boardDom.appendChild(d);
    }
    //竖线
    for(let i=0;i<9;i++){
        const d=document.createElement("div");
        d.className="v-line";
        d.style.left=ox+i*cell+"px";
        boardDom.appendChild(d);
    }

    // ========== 黑方九宫米字格 r0‑r2 c3‑c5 ==========
    addDiag(ox+3*cell, oy+0*cell, cell*2, cell*2);
    addDiag(ox+5*cell, oy+0*cell, -cell*2, cell*2);
    // ========== 红方九宫米字格 r7‑r9 c3‑c5 ==========
    addDiag(ox+3*cell, oy+9*cell, cell*2, -cell*2);
    addDiag(ox+5*cell, oy+9*cell, -cell*2, -cell*2);
}

function addDiag(x,y,w,h){
    const d=document.createElement("div");
    d.className="diag";
    d.style.left=x+"px";
    d.style.top=y+"px";
    d.style.width=Math.sqrt(w*w+h*h)+"px";
    d.style.transform=`rotate(${Math.atan2(h,w)*180/Math.PI}deg)`;
    boardDom.appendChild(d);
}

function render(){
    document.querySelectorAll(".piece").forEach(p=>p.remove());
    for(let r=0;r<10;r++){
        for(let c=0;c<9;c++){
            const item = board[r][c];
            if(item.id===0) continue;
            const div=document.createElement("div");
            if(item.side===2){
                div.className="piece piece-red";
            }else{
                div.className="piece piece-black";
            }
            div.innerText=idToName[item.id];
            div.style.left=(ox+c*cell-24)+"px";
            div.style.top=(oy+r*cell-24)+"px";
            div.dataset.r=r;
            div.dataset.c=c;
            div.onclick=function(){click(r,c);};
            if(selected && selected.r===r && selected.c===c){
                div.classList.add("selected");
            }
            boardDom.appendChild(div);
        }
    }
}

function click(r,c){
    if(!turnRed) return;
    const v=board[r][c];
    if(selected===null){
        if(v.side===2){
            selected={r:r,c:c};
        }
    }else{
        if(selected.r===r && selected.c===c){
            selected=null;
        }else{
            board[r][c]=board[selected.r][selected.c];
            board[selected.r][selected.c]={side:0,id:0};
            selected=null;
            turnRed=false;
        }
    }
    render();
}

drawBoardLines();
render();
console.log("棋盘初始化完成");