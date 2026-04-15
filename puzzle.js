document.body.style.margin = "0"
document.body.style.background = "#111"
document.body.style.color = "#0ff"
document.body.style.fontFamily = "Segoe UI, Tahoma, sans-serif"
document.body.style.display = "flex"
document.body.style.flexDirection = "column"
document.body.style.alignItems = "center"
document.body.style.paddingTop = "20px"

const ui = document.createElement("div")
ui.id = "ui"
ui.style.marginBottom = "10px"
ui.style.fontSize = "16px"
ui.style.fontWeight = "bold"
ui.style.textAlign = "center"
ui.style.lineHeight = "1.5"
ui.style.textShadow = "0 0 5px #0ff"
ui.innerHTML = "INISIALISASI KAMERA & AI..."
document.body.appendChild(ui)

const container = document.createElement("div")
document.body.appendChild(container)

const btn = document.createElement("button")
btn.innerText = "🔄 Main Lagi"
btn.style.marginTop = "15px"
btn.style.padding = "10px 20px"
btn.style.background = "#0ff"
btn.style.color = "#000"
btn.style.fontWeight = "bold"
btn.style.border = "none"
btn.style.cursor = "pointer"
btn.style.borderRadius = "5px"
btn.style.fontSize = "16px"
btn.style.display = "none"
document.body.appendChild(btn)

const videoElement = document.createElement("video")
videoElement.style.display = "none"
videoElement.autoplay = true
videoElement.playsInline = true
document.body.appendChild(videoElement)

let detections = {}
let gameState = 'SCANNING'
let isFraming = false
let captureRect = { x: 0, y: 0, w: 0, h: 0 }
let pieces = []
let cols = 3, rows = 3
let puzzleW, puzzleH, pieceW, pieceH
let puzzleOffsetX = 0, puzzleOffsetY = 0
let draggingPiece = null
let gestureOffsetX = 0, gestureOffsetY = 0
let wasPinching = false
let smoothCursorX = 0, smoothCursorY = 0
const SMOOTH_FACTOR = 0.35
let startTime = 0
let playTime = 0
let isWon = false
let confettis = []

const HAND_CONNECTIONS = [[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[0,9],[9,10],[10,11],[11,12],[0,13],[13,14],[14,15],[15,16],[0,17],[17,18],[18,19],[19,20],[5,9],[9,13],[13,17]]

const hands = new Hands({ locateFile: f => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}` })
hands.setOptions({ maxNumHands: 2, modelComplexity: 1, minDetectionConfidence: 0.7, minTrackingConfidence: 0.7 })
hands.onResults(r => detections = r)

const camera = new Camera(videoElement, {
    onFrame: async () => { await hands.send({ image: videoElement }) },
    width: 640, height: 480
})
camera.start()

function updateUIState(state) {
    if (state === 'SCANNING') ui.innerHTML = "1. Tunjukkan 2 tangan.<br>2. Cubit di kedua tangan untuk membuat bingkai.<br>3. Lepas cubitan untuk foto!"
    else if (state === 'PLAYING') ui.innerHTML = "FOTO DIAMBIL! Gunakan tangan untuk drag puzzle"
    else if (state === 'WON') ui.innerHTML = `🎉 SELESAI ${playTime} detik`
}

function setup() {
    let canvas = createCanvas(640,480)
    canvas.parent(container)
    updateUIState('SCANNING')
}

function draw() {
    background(0)
    if (videoElement.readyState >= 2) {
        push()
        translate(width,0)
        scale(-1,1)
        if (gameState === 'PLAYING') drawingContext.globalAlpha = 0.2
        drawingContext.drawImage(videoElement,0,0,width,height)
        drawingContext.globalAlpha = 1
        pop()
    }

    if (gameState === 'PLAYING') {
        if (!isWon) playTime = floor((millis()-startTime)/1000)

        fill(20,20,30,200)
        stroke('#0ff')
        rect(puzzleOffsetX,puzzleOffsetY,puzzleW,puzzleH)

        for (let p of pieces) if (p!==draggingPiece) p.show()
        if (draggingPiece) draggingPiece.show()

        fill(255)
        textSize(20)
        text(`⏳ ${playTime}s`,15,15)
    }
}

function takeSnapshotAndSlice(r) {
    let gfx = createGraphics(width,height)
    gfx.push()
    gfx.translate(width,0)
    gfx.scale(-1,1)
    gfx.drawingContext.drawImage(videoElement,0,0,width,height)
    gfx.pop()

    let img = gfx.get(r.x,r.y,r.w,r.h)

    puzzleW=r.w
    puzzleH=r.h
    pieceW=puzzleW/cols
    pieceH=puzzleH/rows
    puzzleOffsetX=(width-puzzleW)/2
    puzzleOffsetY=(height-puzzleH)/2

    pieces=[]
    for (let j=0;j<rows;j++) {
        for (let i=0;i<cols;i++) {
            let slice=img.get(i*pieceW,j*pieceH,pieceW,pieceH)
            pieces.push(new Piece(slice,i,j))
        }
    }

    shufflePieces()
    startTime=millis()
    isWon=false
    confettis=[]
    gameState='PLAYING'
    updateUIState('PLAYING')
    btn.style.display="block"
}

function shufflePieces() {
    let pos=[]
    for (let j=0;j<rows;j++) for (let i=0;i<cols;i++) pos.push({col:i,row:j})
    pos.sort(()=>Math.random()-0.5)
    for (let i=0;i<pieces.length;i++) {
        pieces[i].currCol=pos[i].col
        pieces[i].currRow=pos[i].row
        pieces[i].snapToGrid()
    }
}

class Piece {
    constructor(img,c,r){
        this.img=img
        this.origCol=c
        this.origRow=r
        this.currCol=c
        this.currRow=r
        this.x=0
        this.y=0
    }
    snapToGrid(){
        this.x=puzzleOffsetX+(this.currCol*pieceW)
        this.y=puzzleOffsetY+(this.currRow*pieceH)
    }
    show(){
        image(this.img,this.x,this.y,pieceW,pieceH)
        stroke(0,255,255,100)
        rect(this.x,this.y,pieceW,pieceH)
    }
}

class Confetti {
    constructor(){
        this.x=random(width)
        this.y=random(-height,0)
        this.size=random(8,16)
        this.speedY=random(3,8)
        this.speedX=random(-3,3)
    }
    update(){
        this.y+=this.speedY
        this.x+=this.speedX
    }
    show(){
        fill(random(255),random(255),random(255))
        rect(this.x,this.y,this.size,this.size)
    }
}

function resetGame(){
    gameState='SCANNING'
    pieces=[]
    isWon=false
    btn.style.display="none"
    updateUIState('SCANNING')
}

btn.onclick = resetGame