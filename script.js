// ============================================
// CASA DE CARNE H&S - CARDÁPIO ONLINE
// ============================================

const firebaseConfig = {
  apiKey: "AIzaSyAgUXojOAljeRudGNRF9rcvAJ4CNJSVF-s",
  authDomain: "fir-aluguel2.firebaseapp.com",
  databaseURL: "https://fir-aluguel2.firebaseio.com",
  projectId: "fir-aluguel2",
  storageBucket: "fir-aluguel2.appspot.com",
  messagingSenderId: "1082687810478",
  appId: "1:1082687810478:web:3af608b7264b5f95eab63f"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();

const WHATSAPP = "5515998183052"; // <-- COLOQUE O NÚMERO CORRETO AQUI
const CHAVE_PIX = "00.000.000/0000-00"; // <-- COLOQUE A CHAVE PIX REAL AQUI

let categorias = [];
let produtos = [];
let carrinho = [];
let produtoAtual = null;
let avisoMostrado = false;

// ============================================
// NAVEGAÇÃO DE TELAS
// ============================================
window.entrarNaLoja = function() {
    if (!avisoMostrado) {
        alert("As carnes são vendidas por KG e podem sofrer variações de peso/preço. Ao final do pedido enviaremos uma mensagem com o valor exato.");
        avisoMostrado = true;
    }
    const telaHome = document.getElementById('tela-home');
    const appPrincipal = document.getElementById('app-principal');
    telaHome.style.opacity = '0';
    setTimeout(() => {
        telaHome.style.display = 'none';
        appPrincipal.classList.remove('app-escondido');
        window.scrollTo(0, 0);
    }, 300);
}

window.voltarParaHome = function() {
    const telaHome = document.getElementById('tela-home');
    const appPrincipal = document.getElementById('app-principal');
    appPrincipal.classList.add('app-escondido');
    telaHome.style.display = 'flex';
    setTimeout(() => { telaHome.style.opacity = '1'; }, 50);
}

window.abrirSobreNos = function() {
    new bootstrap.Modal(document.getElementById('modalSobre')).show();
}

// ============================================
// CARREGAR DADOS DO FIREBASE
// ============================================
function carregarDados() {
    db.ref('Category').once('value')
        .then(snapCat => {
            categorias = [];
            snapCat.forEach(c => {
                categorias.push({ id: c.key, nome: c.val().name || 'Sem nome' });
            });
            categorias.sort((a, b) => a.id.localeCompare(b.id));
            renderizarNavCategorias();
            return db.ref('Foods').once('value');
        })
        .then(snapProd => {
            produtos = [];
            snapProd.forEach(p => {
                const val = p.val();
                if (val.name && val.menuId) {
                    const parsed = parsePreco(val.price || '');
                    produtos.push({
                        id: p.key,
                        nome: val.name,
                        precoNumerico: parsed.valor,
                        unidade: parsed.unidade,
                        imagem: val.image || '',
                        menuId: val.menuId
                    });
                }
            });
            renderizarProdutos();
            document.getElementById('loading').style.display = 'none';
            carregarCarrinhoSalvo();
        })
        .catch(err => {
            console.error('Erro:', err);
            document.getElementById('loading').innerHTML = '<div class="alert alert-danger">Erro ao carregar produtos.</div>';
        });
}

function parsePreco(precoStr) {
    if (!precoStr || precoStr.trim() === '') return { valor: 0, unidade: 'kg' };
    let str = String(precoStr).replace(/\$/g, '').trim();
    let unidade = 'kg';
    if (/\bun\b/i.test(str) || /unidade/i.test(str)) unidade = 'un';
    else if (/\bkg\b/i.test(str)) unidade = 'kg';
    let nums = str.replace(/[^\d,.]/g, '').trim().replace(',', '.');
    let valor = parseFloat(nums);
    if (isNaN(valor)) valor = 0;
    return { valor, unidade };
}

// ============================================
// RENDERIZAR PRODUTOS
// ============================================
function renderizarNavCategorias() {
    const container = document.getElementById('categorias-scroll');
    if (!container) return;
    let html = '<button class="categoria-chip ativo" onclick="scrollParaCategoria(\'todos\', this)">Todos</button>';
    categorias.forEach(cat => {
        html += `<button class="categoria-chip" onclick="scrollParaCategoria('${cat.id}', this)">${cat.nome}</button>`;
    });
    container.innerHTML = html;
}

function scrollParaCategoria(id, btn) {
    document.querySelectorAll('.categoria-chip').forEach(c => c.classList.remove('ativo'));
    if (btn) btn.classList.add('ativo');
    if (id === 'todos') { window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    const secao = document.getElementById('secao-' + id);
    if (secao) secao.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderizarProdutos(filtro = '') {
    const container = document.getElementById('produtos-container');
    if (!container) return;
    const termo = filtro.toLowerCase().trim();
    let html = '';
    let total = 0;

    categorias.forEach(cat => {
        const produtosCat = produtos.filter(p => {
            const matchCat = p.menuId === cat.id;
            const matchBusca = termo === '' || p.nome.toLowerCase().includes(termo);
            return matchCat && matchBusca;
        });
        if (produtosCat.length === 0) return;
        total += produtosCat.length;

        html += `<section class="categoria-secao" id="secao-${cat.id}"><h2 class