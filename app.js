
// ===== Elementos =====
const elData = document.getElementById("dataCompra");
const elDesc = document.getElementById("descCompra");
const elCat  = document.getElementById("catCompra");
const elValor = document.getElementById("valorTotal");
const elParcelas = document.getElementById("parcelas");

const elAdd = document.getElementById("btnAdd");
const elClear = document.getElementById("btnClear");
const elRecalc = document.getElementById("btnRecalc");

const elLista = document.getElementById("listaCompras");
const elResumo = document.getElementById("resumoFaturas");

const elFiltro = document.getElementById("filtroFatura");
const elCfgFech = document.getElementById("cfgFechamento");
const elCfgVenc = document.getElementById("cfgVencimento");

const CFG_KEY = "gestor_faturas_config_v2";

function loadConfig(){
  try { return JSON.parse(localStorage.getItem(CFG_KEY) || "{}"); }
  catch { return {}; }
}

function saveConfig(cfg){
  localStorage.setItem(CFG_KEY, JSON.stringify(cfg));
}

function getConfig(){
  const cfg = loadConfig();
  return {
    fechamento: Number(cfg.fechamento) || 17,
    vencimento: Number(cfg.vencimento) || 24
  };
}

function validarCfg(){
  const fechamento = parseInt(elCfgFech.value, 10);
  const vencimento = parseInt(elCfgVenc.value, 10);

  if (!Number.isFinite(fechamento) || fechamento < 1 || fechamento > 31) return false;
  if (!Number.isFinite(vencimento) || vencimento < 1 || vencimento > 31) return false;

  saveConfig({ fechamento, vencimento });
  return true;
}

// Inicializa inputs
const cfgInicial = getConfig();
elCfgFech.value = cfgInicial.fechamento;
elCfgVenc.value = cfgInicial.vencimento;
// ===== Utils =====
function brl(n){
  return n.toLocaleString("pt-BR", { style:"currency", currency:"BRL" });
}

function parseDateInput(yyyy_mm_dd){
  const [y, m, d] = yyyy_mm_dd.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function formatarDataBR(dateObj){
  return dateObj.toLocaleDateString("pt-BR");
}

// Regra do ciclo: dia < fechamento => vence mesmo mês; dia >= fechamento => vence mês seguinte
function vencimentoBase(compraDate){
  const { fechamento, vencimento } = getConfig();

  let y = compraDate.getFullYear();
  let m = compraDate.getMonth();
  const d = compraDate.getDate();

  if (d >= fechamento){
    m += 1;
    if (m > 11){ m = 0; y += 1; }
  }
  return new Date(y, m, vencimento);
}
}

function addMonths(dateObj, monthsToAdd){
  let y = dateObj.getFullYear();
  let m = dateObj.getMonth() + monthsToAdd;
  y += Math.floor(m / 12);
  m = m % 12;
  if (m < 0) { m += 12; y -= 1; }
  return new Date(y, m, dateObj.getDate());
}
function recalcularTodasCompras() {

  const compras = loadCompras();
  if (compras.length === 0) return;

  const novas = [];

  compras.forEach((item) => {

    const compraDate = parseDateInput(item.data);
    const baseVenc = vencimentoBase(compraDate);

    const venc = addMonths(baseVenc, (item.parcelaAtual || 1) - 1);

    novas.push({
      ...item,
      vencimento: venc.toISOString()
    });
  });

  saveCompras(novas);
}

// Divide valor em parcelas com centavos corretos (somatório fecha certinho)
function splitIntoInstallments(total, n){
  const totalCents = Math.round(total * 100);
  const base = Math.floor(totalCents / n);
  const resto = totalCents % n;
  const cents = Array.from({length:n}, (_, i) => base + (i < resto ? 1 : 0));
  return cents.map(c => c / 100);
}

function chaveFatura(vencDate){
  const y = vencDate.getFullYear();
  const m = String(vencDate.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function nomeFatura(key){
  const { vencimento } = getConfig();
  const [y, m] = key.split("-").map(Number);
  const venc = new Date(y, m - 1, vencimento);
  return `Venc. ${formatarDataBR(venc)}`;
}
}

// ===== Persistência =====
function loadCompras(){
  try{
    return JSON.parse(localStorage.getItem("gestor_faturas_v2") || "[]");
  }catch{
    return [];
  }
}
function saveCompras(compras){
  localStorage.setItem("gestor_faturas_v2", JSON.stringify(compras));
}

// ===== Render =====
function preencherFiltroFaturas(faturasKeys){
  const atual = elFiltro.value || "todas";
  elFiltro.innerHTML = `<option value="todas">Todas</option>`;

  faturasKeys.forEach(key => {
    const opt = document.createElement("option");
    opt.value = key;
    opt.textContent = `${nomeFatura(key)} (${key})`;
    elFiltro.appendChild(opt);
  });

  // tenta manter seleção anterior
  if ([...elFiltro.options].some(o => o.value === atual)){
    elFiltro.value = atual;
  } else {
    elFiltro.value = "todas";
  }
}

function render(){
  const compras = loadCompras();

  // Mapa de totais por fatura
  const mapaTotais = new Map();
  compras.forEach(c => {
    const venc = new Date(c.vencimento);
    const key = chaveFatura(venc);
    mapaTotais.set(key, (mapaTotais.get(key) || 0) + c.valor);
  });

  const faturasKeys = Array.from(mapaTotais.keys()).sort((a,b)=> a.localeCompare(b));
  preencherFiltroFaturas(faturasKeys);

  // Render resumo
  elResumo.innerHTML = "";
  if (faturasKeys.length === 0){
    elResumo.innerHTML = `<div class="item"><div><b>Sem faturas</b><small>Adicione compras para gerar o resumo.</small></div><span class="badge">—</span></div>`;
  } else {
    faturasKeys.forEach(key => {
      const [y, m] = key.split("-").map(Number);
      const venc = new Date(y, m - 1, VENCIMENTO);
      elResumo.innerHTML += `
        <div class="item">
          <div>
            <b>${brl(mapaTotais.get(key))}</b>
            <small>${nomeFatura(key)}</small>
          </div>
          <span class="badge">${key}</span>
        </div>
      `;
    });
  }

  // Filtragem
  const filtro = elFiltro.value || "todas";
  const comprasFiltradas = (filtro === "todas")
    ? compras
    : compras.filter(c => chaveFatura(new Date(c.vencimento)) === filtro);

  // Ordenar por vencimento e parcela
  comprasFiltradas.sort((a,b) => {
    const av = new Date(a.vencimento).getTime();
    const bv = new Date(b.vencimento).getTime();
    if (av !== bv) return av - bv;
    return (a.parcelaAtual || 1) - (b.parcelaAtual || 1);
  });

  // Render lista (itens)
  elLista.innerHTML = "";
  if (comprasFiltradas.length === 0){
    elLista.innerHTML = `<div class="item"><div><b>Nenhum item nesse filtro</b><small>Troque o filtro ou adicione compras.</small></div><span class="badge">—</span></div>`;
    return;
  }

  comprasFiltradas.forEach(c => {
    const compraDate = parseDateInput(c.data);
    const venc = new Date(c.vencimento);

    const parcTxt = (c.totalParcelas && c.totalParcelas > 1)
      ? ` • Parcela ${c.parcelaAtual}/${c.totalParcelas}`
      : "";

    elLista.innerHTML += `
      <div class="item">
        <div>
          <b>${brl(c.valor)}</b>
          <small>
            ${c.categoria} • ${c.descricao}${parcTxt}<br>
            Compra: ${formatarDataBR(compraDate)} • Vence: ${formatarDataBR(venc)}
          </small>
        </div>

        <div class="right">
          <span class="badge">${chaveFatura(venc)}</span>
          <button class="ghost" style="width:auto; padding:8px 10px"
            onclick="removerCompra('${c.compraId}')">🗑️</button>
        </div>
      </div>
    `;
  });
}

// Excluir compra inteira (apaga todas as parcelas ligadas ao compraId)
window.removerCompra = function(compraId){
  if (!confirm("Excluir esta compra (todas as parcelas)?")) return;
  const compras = loadCompras().filter(c => c.compraId !== compraId);
  saveCompras(compras);
  render();
}

// ===== Ações =====
elAdd.addEventListener("click", () => {
  const data = elData.value;
  const descricao = (elDesc.value || "").trim();
  const categoria = elCat.value;
  const valorTotal = Number(elValor.value);
  const parcelas = parseInt(elParcelas.value, 10);

  if (!data){
    alert("Preencha a data da compra.");
    return;
  }
  if (!descricao){
    alert("Preencha a descrição.");
    return;
  }
  if (!Number.isFinite(valorTotal) || valorTotal <= 0){
    alert("Preencha um valor total válido.");
    return;
  }
  if (!Number.isFinite(parcelas) || parcelas < 1){
    alert("Selecione o número de parcelas.");
    return;
  }

  const compraDate = parseDateInput(data);
  const baseVenc = vencimentoBase(compraDate);
  const valoresParcelas = splitIntoInstallments(valorTotal, parcelas);

  const compras = loadCompras();
  const compraId = (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()));

  for (let i = 0; i < parcelas; i++){
    const venc = addMonths(baseVenc, i);

    compras.push({
      id: compraId + "-" + (i + 1),
      compraId,
      data,
      descricao,
      categoria,
      valor: valoresParcelas[i],
      parcelaAtual: i + 1,
      totalParcelas: parcelas,
      vencimento: venc.toISOString()
    });
  }

  saveCompras(compras);

  // limpa campos
  elValor.value = "";
  elDesc.value = "";
  elParcelas.value = "1";
  elCat.value = "Alimentação";

  render();
});

elClear.addEventListener("click", () => {
  if (confirm("Quer apagar TODAS as compras salvas?")){
    localStorage.removeItem("gestor_faturas_v2");
    render();
  }
});

elFiltro.addEventListener("change", render);
elRecalc.addEventListener("click", () => {
  if (!validarCfg()){
    alert("Configure fechamento e vencimento válidos antes de recalcular.");
    return;
  }
  if (!confirm("Recalcular vencimentos?")) return;
  recalcularTodasCompras();
  render();
});

render();
elRecalc.addEventListener("click", () => {

  if (!confirm("Recalcular vencimentos?")) return;

  recalcularTodasCompras();
  render();
});
elCfgFech.addEventListener("change", () => {
  if (!validarCfg()) alert("Fechamento inválido (1 a 31).");
  render();
});

elCfgVenc.addEventListener("change", () => {
  if (!validarCfg()) alert("Vencimento inválido (1 a 31).");
  render();
});
