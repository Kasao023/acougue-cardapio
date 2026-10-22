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
let avisoMostrado = false; // Controle para o aviso aparecer só uma vez

// ============================================
// NAVEGAÇÃO DE TELAS (HOME / CARDÁPIO)
// ============================================
window.entrarNaLoja = function() {
    // Exibe o aviso (tipo um alerta) apenas na primeira vez que clicar
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
    
    setTimeout(() => {
        telaHome.style.opacity = '1';
    }, 50);
}

window.abrirSobreNos = function() {
    const modal = new bootstrap.Modal(document.getElementById('modalSobre'));
    modal.show();
}

// ============================================
// CARREGAR DADOS DO FIREBASE
// ============================================
function carregarDados() {
    db.ref('Category').once('value')
        .then(snapCat => {
            categorias = [];
            snapCat.forEach(c => {
                categorias.push({
                    id: c.key,
                    nome: c.val().name || 'Sem nome',
                    imagem: c.val().image || ''
                });
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
                        precoOriginal: val.price || '',
                        precoNumerico: parsed.valor,
                        unidade: parsed.unidade,
                        imagem: val.image || '',
                        descricao: val.description || '',
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
            document.getElementById('loading').innerHTML =
                '<div class="alert alert-danger">Erro ao carregar produtos. Verifique a conexão.</div>';
        });
}

// ============================================
// CONVERSOR DE PREÇO
// ============================================
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
// NAVEGAÇÃO DE CATEGORIAS
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

// ============================================
// RENDERIZAR PRODUTOS (LAYOUT LISTA)
// ============================================
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

        html += `
            <section class="categoria-secao" id="secao-${cat.id}">
                <h2 class="categoria-titulo">${cat.nome}</h2>
                <div class="lista-produtos">
        `;

        produtosCat.forEach(prod => {
            const precoExibir = prod.precoNumerico > 0
                ? `R$ ${prod.precoNumerico.toFixed(2).replace('.', ',')} <small>${prod.unidade === 'kg' ? '/kg' : '/un'}</small>`
                : 'Consulte';
            const podeAdicionar = prod.precoNumerico > 0;

            html += `
                <div class="produto-card">
                    <img src="${prod.imagem}" alt="${prod.nome}" class="produto-imagem" loading="lazy" onerror="this.src='https://placehold.co/150x150/eeeeee/999999?text=Sem+Foto'">
                    <div class="produto-info">
                        <h3 class="produto-nome">${prod.nome}</h3>
                        <div class="produto-preco">${precoExibir}</div>
                    </div>
                    ${podeAdicionar 
                        ? `<button class="btn-adicionar" onclick="window.abrirModalPeso('${prod.id}')">
                            <i class="bi bi-plus-lg"></i>
                           </button>`
                        : `<button class="btn-adicionar" style="background:#ccc;cursor:not-allowed;" disabled>
                            <i class="bi bi-x"></i>
                           </button>`
                    }
                </div>
            `;
        });

        html += `</div></section>`;
    });

    if (total === 0) {
        html = `
            <div class="sem-produtos">
                <i class="bi bi-search" style="font-size:3rem;color:#ddd;display:block;margin-bottom:10px;"></i>
                <h4>Nenhum produto encontrado</h4>
                <p>Tente buscar por outro nome</p>
            </div>
        `;
    }

    container.innerHTML = html;
}

window.filtrarProdutos = function() {
    const termo = document.getElementById('busca').value;
    renderizarProdutos(termo);
}

// ============================================
// MODAL DE PESO/QUANTIDADE
// ============================================
window.abrirModalPeso = function(produtoId) {
    const prod = produtos.find(p => p.id === produtoId);
    if (!prod) return;

    produtoAtual = prod;

    document.getElementById('modal-produto-imagem').src = prod.imagem;
    document.getElementById('modal-produto-nome').textContent = prod.nome;
    document.getElementById('modal-produto-preco').textContent = 
        `R$ ${prod.precoNumerico.toFixed(2).replace('.', ',')}${prod.unidade === 'kg' ? ' /kg' : ' /un'}`;

    const wrapperUnidade = document.getElementById('modal-unidade-wrapper');
    const labelQtd = document.getElementById('modal-qtd-label');

    if (prod.unidade === 'un') {
        wrapperUnidade.style.display = 'none';
        labelQtd.textContent = 'Quantidade (unidades)';
        document.getElementById('modal-quantidade').step = '1';
        document.getElementById('modal-quantidade').placeholder = 'Ex: 2';
    } else {
        wrapperUnidade.style.display = 'block';
        labelQtd.textContent = 'Quantidade (g)';
        document.getElementById('modal-quantidade').step = '1';
        document.getElementById('modal-quantidade').placeholder = 'Ex: 500';
        document.getElementById('unidade-g').checked = true;
    }

    document.getElementById('modal-quantidade').value = '';
    document.getElementById('modal-subtotal').textContent = 'R$ 0,00';

    new bootstrap.Modal(document.getElementById('modalPeso')).show();
}

window.setQtd = function(valor) {
    const unidade = document.querySelector('input[name="unidade"]:checked')?.value || 'g';
    const input = document.getElementById('modal-quantidade');

    if (produtoAtual && produtoAtual.unidade === 'un') {
        input.value = valor / 1000;
    } else if (unidade === 'g') {
        input.value = valor;
    } else {
        input.value = valor / 1000;
    }
    atualizarCalculo();
}

window.atualizarCalculo = function() {
    if (!produtoAtual) return;

    const input = document.getElementById('modal-quantidade');
    const labelQtd = document.getElementById('modal-qtd-label');
    const unidade = produtoAtual.unidade === 'un' 
        ? 'un' 
        : (document.querySelector('input[name="unidade"]:checked')?.value || 'g');

    if (produtoAtual.unidade === 'un') {
        labelQtd.textContent = 'Quantidade (unidades)';
    } else {
        labelQtd.textContent = unidade === 'g' ? 'Quantidade (g)' : 'Quantidade (kg)';
    }

    const qtdDigitada = parseFloat(input.value) || 0;
    let quantidadeKg = 0;

    if (produtoAtual.unidade === 'un') {
        quantidadeKg = qtdDigitada;
    } else if (unidade === 'g') {
        quantidadeKg = qtdDigitada / 1000;
    } else {
        quantidadeKg = qtdDigitada;
    }

    const subtotal = produtoAtual.precoNumerico * quantidadeKg;
    document.getElementById('modal-subtotal').textContent = 
        `R$ ${subtotal.toFixed(2).replace('.', ',')}`;
}

window.confirmarAdicao = function() {
    if (!produtoAtual) return;

    const input = document.getElementById('modal-quantidade');
    const qtdDigitada = parseFloat(input.value) || 0;

    if (qtdDigitada <= 0) {
        alert('Informe uma quantidade válida.');
        return;
    }

    const unidade = produtoAtual.unidade === 'un' 
        ? 'un' 
        : (document.querySelector('input[name="unidade"]:checked')?.value || 'g');

    let quantidadeKg = 0;
    let quantidadeExibir = '';

    if (produtoAtual.unidade === 'un') {
        quantidadeKg = qtdDigitada;
        quantidadeExibir = `${qtdDigitada} un`;
    } else if (unidade === 'g') {
        quantidadeKg = qtdDigitada / 1000;
        quantidadeExibir = `${qtdDigitada}g`;
    } else {
        quantidadeKg = qtdDigitada;
        quantidadeExibir = `${qtdDigitada}kg`;
    }

    const subtotal = produtoAtual.precoNumerico * quantidadeKg;

    const item = {
        id: produtoAtual.id,
        nome: produtoAtual.nome,
        imagem: produtoAtual.imagem,
        precoKg: produtoAtual.precoNumerico,
        unidade: produtoAtual.unidade,
        quantidadeKg: quantidadeKg,
        quantidadeExibir: quantidadeExibir,
        subtotal: subtotal
    };

    carrinho.push(item);
    salvarCarrinho();
    atualizarCarrinho();

    bootstrap.Modal.getInstance(document.getElementById('modalPeso')).hide();
    mostrarToast(`${produtoAtual.nome} adicionado!`);
}

// ============================================
// CARRINHO
// ============================================
function atualizarCarrinho() {
    const badge = document.getElementById('badge-carrinho');
    const totalItens = carrinho.length;

    if (totalItens > 0) {
        badge.textContent = totalItens;
        badge.classList.add('visivel');
    } else {
        badge.classList.remove('visivel');
    }

    const body = document.getElementById('carrinho-body');
    const footer = document.getElementById('carrinho-footer');

    if (carrinho.length === 0) {
        body.innerHTML = `
            <div class="carrinho-vazio">
                <i class="bi bi-cart-x"></i>
                <h5>Seu carrinho está vazio</h5>
                <p class="small">Adicione produtos para começar</p>
            </div>
        `;
        footer.style.display = 'none';
        return;
    }

    footer.style.display = 'block';

    let html = '';
    let total = 0;

    carrinho.forEach((item, index) => {
        total += item.subtotal;

        html += `
            <div class="item-carrinho">
                <img src="${item.imagem}" alt="${item.nome}" onerror="this.src='https://placehold.co/100x100/eeeeee/999999?text=?'">
                <div class="item-carrinho-info">
                    <h5>${item.nome}</h5>
                    <div class="item-qtd">${item.quantidadeExibir}</div>
                    <div class="item-preco">R$ ${item.subtotal.toFixed(2).replace('.', ',')}</div>
                </div>
                <button class="btn-remover-item" onclick="window.removerItem(${index})">
                    <i class="bi bi-trash"></i>
                </button>
            </div>
        `;
    });

    body.innerHTML = html;
    document.getElementById('carrinho-total').textContent = 
        `R$ ${total.toFixed(2).replace('.', ',')}`;
}

window.removerItem = function(index) {
    carrinho.splice(index, 1);
    salvarCarrinho();
    atualizarCarrinho();
}

window.abrirCarrinho = function() {
    document.getElementById('carrinho-lateral').classList.add('ativo');
    document.getElementById('carrinho-overlay').classList.add('ativo');
    document.body.style.overflow = 'hidden';
}

window.fecharCarrinho = function() {
    document.getElementById('carrinho-lateral').classList.remove('ativo');
    document.getElementById('carrinho-overlay').classList.remove('ativo');
    document.body.style.overflow = '';
}

// ============================================
// PERSISTÊNCIA DO CARRINHO
// ============================================
function salvarCarrinho() {
    try {
        localStorage.setItem('carrinho_hs', JSON.stringify(carrinho));
    } catch (e) {
        console.error('Erro ao salvar carrinho:', e);
    }
}

function carregarCarrinhoSalvo() {
    try {
        const salvo = localStorage.getItem('carrinho_hs');
        if (salvo) {
            carrinho = JSON.parse(salvo);
            atualizarCarrinho();
        }
    } catch (e) {
        carrinho = [];
    }
}

// ============================================
// FINALIZAR PEDIDO (COM PIX E AVISO)
// ============================================
window.finalizarPedido = function() {
    if (carrinho.length === 0) {
        alert('Seu carrinho está vazio!');
        return;
    }

    let total = 0;
    let mensagem = `*🥩 NOVO PEDIDO - CASA DE CARNE H&S*%0A%0A`;
    mensagem += `━━━━━━━━━━━━━━━━━━%0A`;
    mensagem += `*🛒 ITENS DO PEDIDO*%0A`;

    carrinho.forEach(item => {
        total += item.subtotal;
        const precoKgFmt = item.precoKg.toFixed(2).replace('.', ',');
        const subtotalFmt = item.subtotal.toFixed(2).replace('.', ',');

        mensagem += `%0A▪️ *${item.nome}*%0A`;
        mensagem += `   Qtd: ${item.quantidadeExibir}%0A`;
        mensagem += `   Preço: R$ ${precoKgFmt}${item.unidade === 'kg' ? '/kg' : '/un'}%0A`;
        mensagem += `   Subtotal: R$ ${subtotalFmt}%0A`;
    });

    mensagem += `%0A━━━━━━━━━━━━━━━━━━%0A`;
    mensagem += `*💰 TOTAL: R$ ${total.toFixed(2).replace('.', ',')}*%0A`;
    mensagem += `━━━━━━━━━━━━━━━━━━%0A%0A`;
    
    mensagem += `⚠️ *Aviso:* As carnes são vendidas por KG e podem sofrer variações de peso/preço. Ao final do pedido enviaremos uma mensagem com o valor exato.%0A%0A`;

    mensagem += `*💳 PAGAMENTO VIA PIX*%0A`;
    mensagem += `Chave PIX: *${CHAVE_PIX}*%0A`;
    mensagem += `Favorecido: Casa de Carne H&S%0A%0A`;
    mensagem += `📸 *Após pagar, envie o comprovante nesta conversa para confirmarmos seu pedido!*%0A%0A`;
    mensagem += `📍 Por favor, informe seu endereço de entrega:`;

    const url = `https://wa.me/${WHATSAPP}?text=${mensagem}`;
    window.open(url, '_blank');
}

// ============================================
// TOAST (NOTIFICAÇÃO DE ITEM ADICIONADO)
// ============================================
function mostrarToast(texto) {
    const toast = document.createElement('div');
    toast.style.cssText = `
        position: fixed; top: 20px; left: 50%; transform: translateX(-50%) translateY(-100px);
        background: #25D366; color: #fff; padding: 12px 24px; border-radius: 30px;
        box-shadow: 0 4px 15px rgba(0,0,0,0.2); z-index: 2000; font-weight: 600;
        font-size: 0.9rem; transition: transform 0.3s ease; white-space: nowrap;
    `;
    toast.innerHTML = `<i class="bi bi-check-circle-fill"></i> ${texto}`;
    document.body.appendChild(toast);

    setTimeout(() => toast.style.transform = 'translateX(-50%) translateY(20px)', 10);
    setTimeout(() => {
        toast.style.transform = 'translateX(-50%) translateY(-100px)';
        setTimeout(() => toast.remove(), 300);
    }, 2500);
}

// ============================================
// INICIALIZAÇÃO
// ============================================
document.addEventListener('DOMContentLoaded', carregarDados);