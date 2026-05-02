
let antall_stav = [0, 0, 0];
let alle_pos = {
  unit0: [],
  unit1: [],
  unit2: [],
  unit3: []
};

const unitColors = {
  unit0: "red",
  unit1: "blue",
  unit2: "pink",
  unit3: "orange"
};

let myChart;


let forsyvningx = 200;
let forsyvningy = 200;
let vis_tidligere_posisjoner = false;

const staver = [
  {x: 100, y: 0},
  {x: 0,   y: 160},
  {x: 200, y: 160},
];

async function lagdiagram() {
  try {
    const res = await fetch(`API/dataHits.json?_=${Date.now()}`, {
      cache: "no-store"
    });

    if (!res.ok) {
      throw new Error(`HTTP-feil: ${res.status}`);
    }

    const data = await res.json();
    antall_stav[0] = data.node1;
    antall_stav[1] = data.node2;
    antall_stav[2] = data.node3;

    const ctx = document.getElementById("myChart");
    if (!myChart) {
      myChart = new Chart(ctx, {
        type: "bar",
        data: {
          labels: ["Stav 1", "Stav 2", "Stav 3"],
          datasets: [{
            label: "Antall mikroplast registrert",
            backgroundColor: "rgb(11,198,219)",
            data: antall_stav
          }]
        },
        options: {
          responsive: true,
          scales: {
            y: { beginAtZero: true }
          }
        }
      });
    } else {
      myChart.data.datasets[0].data = antall_stav;
      myChart.update();
    }
  } catch (err) {
    console.error("Klarte ikke å hente JSON:", err);
  }
}


let forrigeData = null;

async function hentdata() {
  try {
    const res = await fetch(`API/dataPos.json?_=${Date.now()}`, {
      cache: "no-store"
    });

    if (!res.ok) {
      throw new Error(`HTTP-feil: ${res.status}`);
    }

    const data = await res.json();

    // Sammenlign ny JSON med gammel
    if (JSON.stringify(data) === JSON.stringify(forrigeData)) {
      return; // Ingen endring -> gjør ingenting
    }

    forrigeData = structuredClone(data);

    for (const unitId in data) {
      if (data.hasOwnProperty(unitId)) {
        const unit = data[unitId];

        if (typeof unit.x !== "number" || typeof unit.y !== "number") {
          throw new Error(`JSON må inneholde tallfeltene x og y for ${unitId}`);
        }

        let koordinat = {
          x: unit.x * 100,
          y: unit.y * 100,
          tid: new Date().toLocaleString("no-NO")
        };

        if (!alle_pos[unitId]) {
          alle_pos[unitId] = [];
        }

        const siste = alle_pos[unitId].at(-1);

        if (!siste || siste.x !== koordinat.x || siste.y !== koordinat.y) {
            alle_pos[unitId].push(koordinat);
        }
      }
    }

    tegnPosisjonerPaNytt();

  } catch (err) {
    console.error("Klarte ikke å hente JSON:", err);
  }
}

function plotprikk(x, y, id, color, tid = "") {
  const kart = document.getElementById("kart");
  const dot = document.createElement("div");

  dot.className = "dot mikro-dot";
  dot.style.left = (x + forsyvningx) + "px";
  dot.style.top = (-y + forsyvningy + 160) + "px";
  dot.style.backgroundColor = color;

  // lag tooltip-element
  const tooltip = document.createElement("div");
  tooltip.className = "tooltip";
  tooltip.textContent = `Tidspunkt: ${tid}`;
  dot.appendChild(tooltip);

  kart.appendChild(dot);
}

function fjernGamlePrikker() {
  document.querySelectorAll("#kart .dot").forEach(el => el.remove());
}

function fjernAlleSporlinjer() {
  document.querySelectorAll("#konturLayer polyline").forEach(el => el.remove());
}

function tegnSporlinje() {
  fjernAlleSporlinjer();

  const svg = ensureKonturLayer();

  // Draw trace line for each unit
  for (const unitId in alle_pos) {
    if (alle_pos[unitId].length < 2) continue;

    const points = alle_pos[unitId]
      .map(pos => `${pos.x + forsyvningx},${-pos.y + forsyvningy+160}`)
      .join(" ");

    const line = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
    line.setAttribute("class", `sporlinje-${unitId}`);
    line.setAttribute("points", points);
    line.setAttribute("fill", "none");
    line.setAttribute("stroke", unitColors[unitId]);
    line.setAttribute("stroke-width", "3");
    line.setAttribute("opacity", "0.7");

    svg.appendChild(line);
  }
}

function tegnPosisjonerPaNytt() {
  fjernGamlePrikker();

  let hasAnyPositions = false;
  for (const unitId in alle_pos) {
    if (alle_pos[unitId].length > 0) {
      hasAnyPositions = true;
      break;
    }
  }

  if (!hasAnyPositions) {
    fjernAlleSporlinjer();
    return;
  }

  if (vis_tidligere_posisjoner) {
    tegnSporlinje();

    // Plot all positions for each unit
    for (const unitId in alle_pos) {
      for (let [i, pos] of alle_pos[unitId].entries()) {
        if (i === alle_pos[unitId].length - 1) {
          // Latest position - full color
          plotprikk(pos.x, pos.y, unitId, unitColors[unitId], pos.tid);
        } else {
          // Earlier positions - faded
          let alpha = (i + 1) / alle_pos[unitId].length;
          plotprikk(pos.x, pos.y, unitId, `rgba(255,255,0,${alpha})`, pos.tid);
        }
      }
    }
  } else {
    fjernAlleSporlinjer();

    // Plot only latest position for each unit
    for (const unitId in alle_pos) {
      if (alle_pos[unitId].length > 0) {
        let siste = alle_pos[unitId].at(-1);
        plotprikk(siste.x, siste.y, unitId, unitColors[unitId], siste.tid);
      }
    }
  }
}
function downloadJSON(filename = 'data.json') {
  // Convert object to a formatted string (2-space indentation)
  const jsonString = JSON.stringify(alle_pos, null, 2);
  
  // Create a Blob from the JSON string
  const blob = new Blob([jsonString], { type: 'application/json' });
  
  // Create a temporary link element
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  
  // Programmatically click the link to trigger the download
  document.body.appendChild(link);
  link.click();
  
  // Clean up by removing the link and revoking the object URL
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}

function plotlegend(){
  const legend = document.getElementById("legend");
  const units = Object.keys(unitColors);
  for (let i = 0; i < units.length; i++) {
    let unitId = units[i];

    legend.innerHTML += `
      <div class="legend-item">
        <span class="legend-dot" style="background:${unitColors[unitId]}"></span>
        <span>Mikroplastenhet ${i+1}</span>
      </div>
    `;
  }
}



function plotstav(x, y) {
  const kart = document.getElementById("kart");
  const dot = document.createElement("div");

  dot.className = "stav";
  dot.style.left = (x + forsyvningx) + "px";
  dot.style.top = (y + forsyvningy) + "px";

  kart.appendChild(dot);
}

function switchPosState() {
  if (vis_tidligere_posisjoner){
    vis_tidligere_posisjoner=false
  }else{
    vis_tidligere_posisjoner = true;
  }
  tegnPosisjonerPaNytt();
}

function visnåværendeposisjon() {
  vis_tidligere_posisjoner = false;
  tegnPosisjonerPaNytt();
}

function tomtidligereposisjoner() {
  alle_pos.unit0.length = 0;
  alle_pos.unit1.length = 0;
  alle_pos.unit2.length = 0;
  alle_pos.unit3.length = 0;
  fjernGamlePrikker();
  fjernAlleSporlinjer();
}





function plotSentrumPrikk(x, y) {
  const kart = document.getElementById("kart");
  const p = document.createElement("div");

  p.className = "sentrumprikk";
  p.style.left = (x + forsyvningx) + "px";
  p.style.top = (y + forsyvningy) + "px";

  kart.appendChild(p);
}

function ensureKonturLayer() {
  const svg = document.getElementById("konturLayer");
  const kart = document.getElementById("kart");

  const w = kart.clientWidth;
  const h = kart.clientHeight;

  svg.setAttribute("viewBox", `0 0 ${w} ${h}`);

  return svg;
}

function tegnNivaakurver(px, py, opts = {}) {
  const {
    antall = 6,
    steg = 18,
    startRadius = 10,
    opacityStart = 0.5,
    opacityFall = 0.09,
    strokeWidth = 2
  } = opts;

  const svg = ensureKonturLayer();

  const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
  g.setAttribute("class", "kontur");

  for (let i = 0; i < antall; i++) {
    const r = startRadius + i * steg;

    const c = document.createElementNS("http://www.w3.org/2000/svg", "circle");

    c.setAttribute("cx", px);
    c.setAttribute("cy", py);
    c.setAttribute("r", r);
    c.setAttribute("fill", "none");
    c.setAttribute("stroke", "black");
    c.setAttribute("stroke-width", strokeWidth);
    c.setAttribute("opacity", Math.max(0, opacityStart - i * opacityFall));

    g.appendChild(c);
  }

  svg.appendChild(g);

  return g;
}

function oppdaterPosisjonChip() {
  // Her kan du eventuelt vise siste tid/posisjon i HTML senere.
}

window.addEventListener("load", () => {
  console.log("neinei")
  plotlegend();
  for (const s of staver) {
    plotstav(s.x, s.y);
    plotSentrumPrikk(s.x, s.y);

    const px = s.x + forsyvningx;
    const py = s.y + forsyvningy;

    tegnNivaakurver(px, py, {
      antall: 7,
      steg: 16,
      startRadius: 8
    });
  }

  lagdiagram();
  hentdata();

  setInterval(hentdata, 2000);
  setInterval(lagdiagram, 2000)
});

window.addEventListener("resize", () => {
  ensureKonturLayer();
});