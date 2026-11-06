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

const WHATSAPP = "5515998027793";

let categorias = [];
let produtos = [];
let promocoes = [];
let carrinho = [];
let produtoAtual = null;
let qtdDetalhes = 1;
let statusLoja = { manual: 'auto', aberto: false, mensagem: '' };

// ============================================
// FUNÇÃO AUXILIAR: IDENTIFICAR SE É KIT
// ============================================
function ehKit(prod) {
    if (prod.isKit === true) return true;
    if (prod.nome && prod.nome.toLowerCase().includes('kit')) return true;
    const cat = categorias.find(c => c.id === prod.menuId);
    if (cat && cat.nome.toLowerCase().includes('kit')) return true;
    return false;
}

// NAVEGAÇÃO DE TELAS
window.entrarNaLoja = function() {
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

// MODAL SOBRE NÓS
window.abrirSobreNos = function() { document.getElementById('modalSobre').classList.add('show'); }
window.fecharSobreNos = function() { document.getElementById('modalSobre').classList.remove('show'); }
window.mudarAba = function(abaId, btn) {
    document.querySelectorAll('.aba-btn').forEach(b => b.classList.remove('ativo'));
    btn.classList.add('ativo');
    document.querySelectorAll('.aba-conteudo').forEach(c => c.classList.remove('ativo'));
    document.getElementById('aba-conteudo-' + abaId).classList.add('ativo');
}

// VERIFICAR FORMA DE PAGAMENTO (TROCO)
window.verificarPagamento = function() {
    const pagamento = document.getElementById('cli-pagamento').value;
    const wrapperTroco = document.getElementById('wrapper-troco');
    if (pagamento === 'Dinheiro') {
        wrapperTroco.classList.remove('d-none');
    } else {
        wrapperTroco.classList.add('d-none');
        document.getElementById('cli-troco').value = '';
    }
}

// ============================================
// STATUS ABERTO / FECHADO (HÍBRIDO)
// ============================================
function calcularStatusAutomatico() {
    const agora = new Date();
    const opcoes = { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', weekday: 'short', hour12: false };
    const partes = new Intl.DateTimeFormat('pt-BR', opcoes).formatToParts(agora);
    
    let diaSemana = '';
    let hora = 0;
    let minuto = 0;
    
    partes.forEach(p => {
        if (p.type === 'weekday') diaSemana = p.value.toLowerCase();
        if (p.type === 'hour') hora = parseInt(p.value);
        if (p.type === 'minute') minuto = parseInt(p.value);
    });

    const minutosAgora = hora * 60 + minuto;

    // 08:00 = 480 min | 19:00 = 1140 min | 18:00 = 1080 min
    let aberto = false;
    let mensagem = '';

    if (diaSemana.includes('seg') || diaSemana.includes('ter') || diaSemana.includes('qua') || diaSemana.includes('qui') || diaSemana.includes('sex')) {
        aberto = minutosAgora >= 480 && minutosAgora < 1140;
        if (aberto) mensagem = 'Aberto para pedidos';
        else if (minutosAgora < 480) mensagem = 'Abre hoje às 08:00';
        else mensagem = 'Fechado • Abre amanhã às 08:00';
    } else if (diaSemana.includes('sáb') || diaSemana.includes('sab')) {
        aberto = minutosAgora >= 480 && minutosAgora < 1080;
        if (aberto) mensagem = 'Aberto para pedidos';
        else if (minutosAgora < 480) mensagem = 'Abre hoje às 08:00';
        else mensagem = 'Fechado • Abre segunda às 08:00';
    } else {
        aberto = false;
        mensagem = 'Fechado • Abre segunda às 08:00';
    }

    return { aberto, mensagem };
}

function aplicarStatusNaTela() {
    const el = document.getElementById('status-loja');
    if (!el) return;

    const auto = calcularStatusAutomatico();

    if (statusLoja.manual === 'aberta') {
        el.className = 'topo-status-fechado aberto';
        el.innerHTML = `<i class="bi bi-check-circle-fill"></i> Aberto para pedidos`;
        statusLoja.aberto = true;
        statusLoja.mensagem = 'Aberto para pedidos';
    } else if (statusLoja.manual === 'fechada') {
        el.className = 'topo-status-fechado fechado';
        el.innerHTML = `<i class="bi bi-x-circle-fill"></i> Fechado no momento`;
        statusLoja.aberto = false;
        statusLoja.mensagem = 'Fechado no momento';
    } else {
        // Automático
        statusLoja.aberto = auto.aberto;
        statusLoja.mensagem = auto.mensagem;
        if (auto.aberto) {
            el.className = 'topo-status-fechado aberto';
            el.innerHTML = `<i class="bi bi-check-circle-fill"></i> ${auto.mensagem}`;
        } else {
            el.className = 'topo-status-fechado fechado';
            el.innerHTML = `<i class="bi bi-x-circle-fill"></i> ${auto.mensagem}`;
        }
    }
}

function ouvirStatusLoja() {
    db.ref('config/lojaStatus').on('value', snap => {
        const val = snap.val();
        statusLoja.manual = val || 'auto';
        aplicarStatusNaTela();
    });
}

// ============================================
// CARREGAR DADOS DO FIREBASE
// ============================================
function carregarDados() {
    db.ref('Category').once('value').then(snapCat => {
        categorias = [];
        snapCat.forEach(c => {
            const val = c.val();
            if (val && val.name) {
                categorias.push({ id: c.key, nome: val.name });
            }
        });

        categorias.sort((a, b) => {
            const ordemFixa = ['Promoção', 'Kits da Semana', 'Kits Churrasco', 'Promoções', 'Bovino', 'Suíno', 'Aves', 'Assados e Domingos'];
            const posA = ordemFixa.indexOf(a.nome);
            const posB = ordemFixa.indexOf(b.nome);
            const finalA = posA === -1 ? 999 : posA;
            const finalB = posB === -1 ? 999 : posB;
            if (finalA !== finalB) return finalA - finalB;
            return a.nome.localeCompare(b.nome);
        });

        return Promise.all([
            db.ref('Foods').once('value').catch(() => null),
            db.ref('FoodsC').once('value').catch(() => null),
            db.ref('Promocoes').once('value').catch(() => null)
        ]);
    }).then(([snapProd, snapProdC, snapPromo]) => {
        produtos = [];
        promocoes = [];

        if (snapProd && snapProd.exists()) {
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
                        menuId: val.menuId,
                        disponivel: val.disponivel !== false,
                        isKit: false,
                        serve: val.serve || 'N/A',
                        itens: val.itens || 'Informações no local',
                        detalhes: val.detalhes || 'Produto fresco e de alta qualidade.'
                    });
                }
            });
        }

        if (snapProdC && snapProdC.exists()) {
            snapProdC.forEach(p => {
                const val = p.val();
                if (val.nameC && val.menuId) {
                    const parsed = parsePreco(val.priceC || '');
                    produtos.push({
                        id: p.key,
                        nome: val.nameC,
                        precoNumerico: parsed.valor,
                        unidade: 'un',
                        imagem: val.imageC || '',
                        menuId: val.menuId,
                        disponivel: val.disponivel !== false,
                        isKit: true,
                        serve: val.serveC || '5',
                        itens: val.itensC || 'Consulte os itens na arte do kit',
                        detalhes: val.detalhesC || 'Kit completo e selecionado.'
                    });
                }
            });
        }

        if (snapPromo && snapPromo.exists()) {
            snapPromo.forEach(p => {
                const val = p.val();
                if (val.imagem) {
                    promocoes.push({ id: p.key, imagem: val.imagem });
                }
            });
        }

        renderizarNavCategorias();
        renderizarProdutos();
        document.getElementById('loading').style.display = 'none';
        carregarCarrinhoSalvo();
    }).catch(err => {
        console.error('Erro:', err);
        document.getElementById('loading').innerHTML = '<div class="alert alert-danger text-center my-3">Erro ao carregar produtos. Verifique sua conexão.</div>';
    });
}

function parsePreco(precoStr) {
    if (!precoStr || String(precoStr).trim() === '') return { valor: 0, unidade: 'un' };
    let str = String(precoStr).replace(/\$/g, '').trim();
    let unidade = 'un';
    if (/\bkg\b/i.test(str)) unidade = 'kg';
    else if (/\bun\b/i.test(str) || /unidade/i.test(str)) unidade = 'un';
    
    let nums = str.replace(/[^\d,.]/g, '').trim().replace(',', '.');
    let valor = parseFloat(nums);
    if (isNaN(valor)) valor = 0;
    return { valor, unidade };
}

// RENDERIZAR NAVEGAÇÃO
function renderizarNavCategorias() {
    const container = document.getElementById('categorias-scroll');
    if (!container) return;
    let html = '<button class="categoria-chip ativo" onclick="scrollParaCategoria(\'todos\', this)">Todos</button>';
    
    if (promocoes.length > 0) {
        html += `<button class="categoria-chip" onclick="scrollParaCategoria('promocao', this)">🔥 Promoção</button>`;
    }
    
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

// RENDERIZAR PRODUTOS (INCLUINDO PROMOÇÕES)
function renderizarProdutos(filtro = '') {
    const container = document.getElementById('produtos-container');
    if (!container) return;
    const termo = filtro.toLowerCase().trim();
    let html = '';
    let total = 0;

    if (promocoes.length > 0 && (termo === '' || termo.includes('promo'))) {
        html += `<section class="categoria-secao" id="secao-promocao">`;
        html += `<h2 class="categoria-titulo-promo"><i class="bi bi-fire"></i> Promoção</h2>`;
        html += `<div class="lista-promocoes">`;
        
        promocoes.forEach(promo => {
            html += `
                <div class="promo-card" onclick="window.abrirLightbox('${promo.imagem}')" style="cursor: zoom-in;">
                    <img src="${promo.imagem}" alt="Promoção" class="promo-imagem" loading="lazy"
                         onerror="this.src='https://placehold.co/600x400/eeeeee/999999?text=Promoção'">
                </div>
            `;
        });
        
        html += `</div></section>`;
        total += promocoes.length;
    }

    categorias.forEach(cat => {
        const produtosCat = produtos.filter(p => {
            const matchCat = p.menuId === cat.id;
            const matchBusca = termo === '' || p.nome.toLowerCase().includes(termo);
            const estaDisponivel = p.disponivel !== false;
            return matchCat && matchBusca && estaDisponivel;
        });
        if (produtosCat.length === 0) return;
        total += produtosCat.length;

        html += `<section class="categoria-secao" id="secao-${cat.id}"><h2 class="categoria-titulo">${cat.nome}</h2><div class="lista-produtos">`;

        produtosCat.forEach(prod => {
            const precoExibir = prod.precoNumerico > 0
                ? `R$ ${prod.precoNumerico.toFixed(2).replace('.', ',')} <small>${prod.unidade === 'kg' ? '/kg' : '/un'}</small>`
                : 'Consulte';
            const podeAdicionar = prod.precoNumerico > 0;
            const isKit = ehKit(prod);
            const classeCard = isKit ? 'produto-card kit-card' : 'produto-card';

            if (isKit) {
                html += `
                    <div class="${classeCard}" 
                         style="cursor: pointer;"
                         onclick="window.clicarKit('${prod.id}')">
                        <img src="${prod.imagem}" alt="${prod.nome}" class="produto-imagem" loading="lazy" 
                             onerror="this.src='https://placehold.co/150x150/eeeeee/999999?text=Sem+Foto'">
                        <div class="produto-info">
                            <h3 class="produto-nome">${prod.nome}</h3>
                            <div class="produto-preco">${precoExibir}</div>
                        </div>
                    </div>
                `;
            } else {
                html += `
                    <div class="${classeCard}">
                        <img src="${prod.imagem}" alt="${prod.nome}" class="produto-imagem" loading="lazy" 
                             onerror="this.src='https://placehold.co/150x150/eeeeee/999999?text=Sem+Foto'">
                        <div class="produto-info">
                            <h3 class="produto-nome">${prod.nome}</h3>
                            <div class="produto-preco">${precoExibir}</div>
                        </div>
                        ${podeAdicionar 
                            ? `<button class="btn-adicionar" onclick="window.abrirModalPeso('${prod.id}')"><i class="bi bi-plus-lg"></i></button>` 
                            : `<button class="btn-adicionar" style="background:#ccc; color:#fff;" disabled><i class="bi bi-x"></i></button>`}
                    </div>
                `;
            }
        });
        html += `</div></section>`;
    });

    if (total === 0) {
        html = `<div class="sem-produtos"><i class="bi bi-search" style="font-size:3rem;color:#ddd;display:block;margin-bottom:10px;"></i><h4>Nenhum produto encontrado</h4></div>`;
    }
    container.innerHTML = html;
}

window.filtrarProdutos = function() {
    renderizarProdutos(document.getElementById('busca').value);
}

window.clicarKit = function(id) {
    window.abrirDetalhes(id);
};

// TELA DE DETALHES
window.abrirDetalhes = function(id) {
    const prod = produtos.find(p => p.id === id);
    if (!prod) { console.error('Produto não encontrado:', id); return; }

    produtoAtual = prod;
    qtdDetalhes = 1;

    document.getElementById('det-img').src = prod.imagem;
    document.getElementById('det-nome').textContent = prod.nome;
    document.getElementById('det-preco').textContent = `R$ ${prod.precoNumerico.toFixed(2).replace('.', ',')}`;
    document.getElementById('det-serve').textContent = prod.serve || 'N/A';
    document.getElementById('det-itens').textContent = prod.itens;
    document.getElementById('det-descricao').textContent = prod.detalhes;
    
    document.getElementById('det-qtd-txt').textContent = qtdDetalhes;
    document.getElementById('detalhes-texto').style.display = 'none';
    document.getElementById('preparo-texto').style.display = 'none';

    document.getElementById('det-btn-add').onclick = () => {
        window.fecharDetalhes();
        window.abrirModalPeso(id, qtdDetalhes);
    };

    const modal = document.getElementById('modalDetalhes');
    modal.style.display = 'flex';
    modal.classList.add('show');
    document.body.style.overflow = 'hidden';
}

window.fecharDetalhes = function() {
    const modal = document.getElementById('modalDetalhes');
    modal.classList.remove('show');
    modal.style.display = 'none';
    document.body.style.overflow = '';
}

window.alterarQtdDetalhes = function(acao) {
    if (acao === -1 && qtdDetalhes > 1) qtdDetalhes--;
    else if (acao === 1) qtdDetalhes++;
    document.getElementById('det-qtd-txt').textContent = qtdDetalhes;
}

window.toggleInfo = function(elementId) {
    const el = document.getElementById(elementId);
    el.style.display = el.style.display === 'none' ? 'block' : 'none';
}

// LIGHTBOX
window.abrirLightbox = function(urlImagem) {
    let lightbox = document.getElementById('lightbox-modal');
    if (!lightbox) {
        lightbox = document.createElement('div');
        lightbox.id = 'lightbox-modal';
        lightbox.className = 'lightbox-overlay';
        lightbox.innerHTML = `
            <button class="btn-fechar-lightbox" onclick="window.fecharLightbox()">&times;</button>
            <div class="lightbox-content" onclick="event.stopPropagation()">
                <img id="lightbox-img" src="" alt="Zoom">
            </div>
        `;
        lightbox.onclick = function() { window.fecharLightbox(); };
        document.body.appendChild(lightbox);
    }
    document.getElementById('lightbox-img').src = urlImagem;
    setTimeout(() => lightbox.classList.add('show'), 10);
};

window.fecharLightbox = function() {
    const lightbox = document.getElementById('lightbox-modal');
    if (lightbox) lightbox.classList.remove('show');
};

// MODAL DE ADIÇÃO
window.abrirModalPeso = function(produtoId, qtdPreDefinida = null) {
    const prod = produtos.find(p => p.id === produtoId);
    if (!prod) return;
    produtoAtual = prod;

    document.getElementById('modal-produto-imagem').src = prod.imagem;
    document.getElementById('modal-produto-nome').textContent = prod.nome;
    document.getElementById('modal-produto-preco').textContent = `R$ ${prod.precoNumerico.toFixed(2).replace('.', ',')}${prod.unidade === 'kg' ? ' /kg' : ' /un'}`;

    const wrapperUnidade = document.getElementById('modal-unidade-wrapper');
    const labelQtd = document.getElementById('modal-qtd-label');
    const opcoesCorte = document.getElementById('opcoes-corte-wrapper');
    const qtdRapida = document.getElementById('qtd-rapida-wrapper');

    const isKitBlindado = ehKit(prod) || prod.unidade === 'un';

    if (isKitBlindado) {
        wrapperUnidade.style.display = 'none';
        opcoesCorte.style.display = 'none';
        if (qtdRapida) qtdRapida.style.display = 'none';
        labelQtd.textContent = 'Quantidade (unidades)';
        document.getElementById('modal-quantidade').placeholder = 'Ex: 2';
    } else {
        wrapperUnidade.style.display = 'block';
        opcoesCorte.style.display = 'block';
        if (qtdRapida) qtdRapida.style.display = 'flex';
        labelQtd.textContent = 'Quantidade (g)';
        document.getElementById('modal-quantidade').placeholder = 'Ex: 500';
        document.getElementById('unidade-g').checked = true;
    }

    document.getElementById('modal-quantidade').value = qtdPreDefinida !== null ? qtdPreDefinida : '';
    document.getElementById('modal-observacao').value = '';
    document.getElementById('corte-inteiro').checked = true;
    
    window.atualizarCalculo();

    new bootstrap.Modal(document.getElementById('modalPeso')).show();
}

window.setQtd = function(valor) {
    const unidade = document.querySelector('input[name="unidade"]:checked')?.value || 'g';
    const input = document.getElementById('modal-quantidade');
    const isKit = ehKit(produtoAtual) || produtoAtual.unidade === 'un';
    if (isKit) input.value = valor / 1000;
    else if (unidade === 'g') input.value = valor;
    else input.value = valor / 1000;
    atualizarCalculo();
}

window.atualizarCalculo = function() {
    if (!produtoAtual) return;
    const input = document.getElementById('modal-quantidade');
    const labelQtd = document.getElementById('modal-qtd-label');
    const isKit = ehKit(produtoAtual) || produtoAtual.unidade === 'un';
    const unidade = isKit ? 'un' : (document.querySelector('input[name="unidade"]:checked')?.value || 'g');

    if (!isKit) labelQtd.textContent = unidade === 'g' ? 'Quantidade (g)' : 'Quantidade (kg)';

    const qtdDigitada = parseFloat(input.value) || 0;
    let quantidadeKg = isKit ? qtdDigitada : (unidade === 'g' ? qtdDigitada / 1000 : qtdDigitada);
    const subtotal = produtoAtual.precoNumerico * quantidadeKg;
    document.getElementById('modal-subtotal').textContent = `R$ ${subtotal.toFixed(2).replace('.', ',')}`;
}

window.confirmarAdicao = function() {
    if (!produtoAtual) return;
    const input = document.getElementById('modal-quantidade');
    const qtdDigitada = parseFloat(input.value) || 0;

    if (qtdDigitada <= 0) { alert('Informe uma quantidade válida.'); return; }

    const isKit = ehKit(produtoAtual) || produtoAtual.unidade === 'un';
    const unidade = isKit ? 'un' : (document.querySelector('input[name="unidade"]:checked')?.value || 'g');
    
    let quantidadeKg = isKit ? qtdDigitada : (unidade === 'g' ? qtdDigitada / 1000 : qtdDigitada);
    let quantidadeExibir = isKit ? `${qtdDigitada} un` : (unidade === 'g' ? `${qtdDigitada}g` : `${qtdDigitada}kg`);
    const subtotal = produtoAtual.precoNumerico * quantidadeKg;

    let tipoCorte = '';
    if (!isKit && produtoAtual.unidade === 'kg') {
        tipoCorte = document.querySelector('input[name="tipoCorte"]:checked')?.value || 'Inteiro';
    }
    const observacao = document.getElementById('modal-observacao').value.trim();

    const item = {
        id: produtoAtual.id, nome: produtoAtual.nome, imagem: produtoAtual.imagem,
        precoKg: produtoAtual.precoNumerico, unidade: unidade,
        quantidadeKg: quantidadeKg, quantidadeExibir: quantidadeExibir,
        subtotal: subtotal, tipoCorte: tipoCorte, observacao: observacao
    };

    carrinho.push(item);
    salvarCarrinho();
    atualizarCarrinho();
    bootstrap.Modal.getInstance(document.getElementById('modalPeso')).hide();
    mostrarToast(`${produtoAtual.nome} adicionado!`);
}

// CARRINHO
function atualizarCarrinho() {
    const badge = document.getElementById('badge-carrinho');
    if (badge) {
        if (carrinho.length > 0) { badge.textContent = carrinho.length; badge.style.display = 'flex'; }
        else badge.style.display = 'none';
    }

    const body = document.getElementById('carrinho-body');
    const footer = document.getElementById('carrinho-footer');

    if (carrinho.length === 0) {
        body.innerHTML = `<div class="carrinho-vazio"><i class="bi bi-cart-x"></i><h5>Seu carrinho está vazio</h5><p class="small">Adicione produtos para começar</p></div>`;
        footer.style.display = 'none';
        return;
    }

    footer.style.display = 'block';
    let html = '';
    let total = 0;

    carrinho.forEach((item, index) => {
        total += item.subtotal;
        let detalhesExtras = '';
        if (item.tipoCorte) detalhesExtras += `<div class="item-obs"><strong>Corte:</strong> ${item.tipoCorte}</div>`;
        if (item.observacao) detalhesExtras += `<div class="item-obs"><strong>Obs:</strong> ${item.observacao}</div>`;

        html += `
            <div class="item-carrinho">
                <img src="${item.imagem}" alt="${item.nome}" onerror="this.src='https://placehold.co/100x100/eeeeee/999999?text=?'">
                <div class="item-carrinho-info">
                    <h5>${item.nome}</h5>
                    <div class="item-qtd">${item.quantidadeExibir}</div>
                    ${detalhesExtras}
                    <div class="item-preco">R$ ${item.subtotal.toFixed(2).replace('.', ',')}</div>
                </div>
                <button class="btn-remover-item" onclick="window.removerItem(${index})"><i class="bi bi-trash"></i></button>
            </div>
        `;
    });

    body.innerHTML = html;
    document.getElementById('carrinho-total').textContent = `R$ ${total.toFixed(2).replace('.', ',')}`;
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

function salvarCarrinho() {
    try { localStorage.setItem('carrinho_hs', JSON.stringify(carrinho)); } catch (e) {}
}

function carregarCarrinhoSalvo() {
    try {
        const salvo = localStorage.getItem('carrinho_hs');
        if (salvo) { carrinho = JSON.parse(salvo); atualizarCarrinho(); }
    } catch (e) { carrinho = []; }
}

// MODAL DE ENDEREÇO
window.abrirModalEndereco = function() {
    if (carrinho.length === 0) { alert('Seu carrinho está vazio!'); return; }
    window.fecharCarrinho();

    const dadosSalvos = JSON.parse(localStorage.getItem('cliente_hs') || '{}');
    if (dadosSalvos.nome) document.getElementById('cli-nome').value = dadosSalvos.nome;
    if (dadosSalvos.rua) document.getElementById('cli-rua').value = dadosSalvos.rua;
    if (dadosSalvos.numero) document.getElementById('cli-numero').value = dadosSalvos.numero;
    if (dadosSalvos.bairro) document.getElementById('cli-bairro').value = dadosSalvos.bairro;
    if (dadosSalvos.complemento) document.getElementById('cli-complemento').value = dadosSalvos.complemento;

    document.getElementById('wrapper-troco').classList.add('d-none');
    document.getElementById('cli-troco').value = '';

    new bootstrap.Modal(document.getElementById('modalEndereco')).show();
}

// ENVIAR PEDIDO WHATSAPP
window.enviarPedidoWhatsApp = function() {
    // Bloqueia se loja estiver fechada
    if (!statusLoja.aberto) {
        alert('A loja está fechada no momento. Volte no horário de funcionamento para fazer seu pedido.');
        return;
    }

    const nome = document.getElementById('cli-nome').value.trim();
    const rua = document.getElementById('cli-rua').value.trim();
    const numero = document.getElementById('cli-numero').value.trim();
    const bairro = document.getElementById('cli-bairro').value.trim();
    const complemento = document.getElementById('cli-complemento').value.trim();
    const pagamento = document.getElementById('cli-pagamento').value;
    const trocoInput = document.getElementById('cli-troco').value;
    const troco = parseFloat(trocoInput) || 0;

    if (!nome || !rua || !numero || !bairro || !pagamento) {
        alert('Por favor, preencha todos os campos obrigatórios (*) antes de enviar.');
        return;
    }

    if (pagamento === 'Dinheiro' && trocoInput && troco > 0) {
        const totalCarrinho = carrinho.reduce((acc, item) => acc + item.subtotal, 0);
        if (troco < totalCarrinho) {
            alert(`O valor do troco (R$ ${troco.toFixed(2)}) é menor que o total estimado do pedido (R$ ${totalCarrinho.toFixed(2)}).`);
            return;
        }
    }

    const dadosCliente = { nome, rua, numero, bairro, complemento };
    localStorage.setItem('cliente_hs', JSON.stringify(dadosCliente));

    let total = 0;
    let mensagem = `*NOVO PEDIDO - CASA DE CARNE H&S*\n`;
    mensagem += `----------------------------------------\n\n`;
    mensagem += `*DADOS DO CLIENTE:*\n`;
    mensagem += `👤 Nome: ${nome}\n`;
    mensagem += `📍 Endereço: ${rua}, ${numero}\n`;
    mensagem += `🏘️ Bairro: ${bairro}\n`;
    if (complemento) mensagem += `🏠 Complemento: ${complemento}\n`;
    mensagem += `💳 Pagamento: ${pagamento}\n`;
    if (pagamento === 'Dinheiro' && troco > 0) {
        mensagem += `💵 Troco para: R$ ${troco.toFixed(2).replace('.', ',')}\n`;
    }
    mensagem += `\n----------------------------------------\n\n`;
    mensagem += `*ITENS DO PEDIDO:*\n`;

    carrinho.forEach(item => {
        total += item.subtotal;
        const subtotalFmt = item.subtotal.toFixed(2).replace('.', ',');
        mensagem += `\n- *${item.nome}*\n`;
        mensagem += `  📦 Qtd: ${item.quantidadeExibir}\n`;
        if (item.tipoCorte) mensagem += `  ✂️ Corte: ${item.tipoCorte}\n`;
        if (item.observacao) mensagem += `  📝 Obs: ${item.observacao}\n`;
        mensagem += `  💵 Subtotal: R$ ${subtotalFmt}\n`;
    });

    mensagem += `\n----------------------------------------\n`;
    mensagem += `*VALOR ESTIMADO: R$ ${total.toFixed(2).replace('.', ',')}*\n`;
    mensagem += `----------------------------------------\n\n`;
    mensagem += `⚠️ *ATENÇÃO: NÃO REALIZE O PAGAMENTO AINDA!*\n\n`;
    mensagem += `Como as carnes são vendidas por KG, o valor acima é apenas uma *estimativa*.\n\n`;
    mensagem += `🥩 *Iremos pesar os produtos e enviar o valor final e a Chave PIX nesta conversa.*\n\n`;
    mensagem += `Por favor, *aguarde a nossa confirmação* para realizar o pagamento. Evitando assim a necessidade de pagamentos adicionais ou reembolsos.\n\n`;
    mensagem += `Obrigado pela preferência! 😊`;

    bootstrap.Modal.getInstance(document.getElementById('modalEndereco')).hide();
    const url = `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(mensagem)}`;
    window.open(url, '_blank');
}

// TOAST
function mostrarToast(texto) {
    const toast = document.createElement('div');
    toast.style.cssText = `
        position: fixed; top: 20px; left: 50%; transform: translateX(-50%) translateY(-100px);
        background: #25D366; color: #fff; padding: 12px 24px; border-radius: 30px;
        box-shadow: 0 4px 15px rgba(0,0,0,0.2); z-index: 9999; font-weight: 600;
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

// INICIALIZAÇÃO
document.addEventListener('DOMContentLoaded', function() {
    carregarDados();
    ouvirStatusLoja();
    // Atualiza o status automático a cada 1 minuto
    setInterval(aplicarStatusNaTela, 60000);

    const carousel = document.getElementById('bannerCarousel');
    const dots = document.querySelectorAll('.banner-dots .dot');
    const items = document.querySelectorAll('.banner-item');

    if (carousel && items.length > 0) {
        let currentIndex = 0;
        let autoScrollInterval;

        function scrollToIndex(index) {
            const itemWidth = items[0].offsetWidth + 15;
            carousel.scrollTo({ left: index * itemWidth, behavior: 'smooth' });
            updateDots(index);
        }

        function updateDots(index) {
            dots.forEach((dot, i) => {
                if (i === index) dot.classList.add('ativo');
                else dot.classList.remove('ativo');
            });
            currentIndex = index;
        }

        carousel.addEventListener('scroll', () => {
            const itemWidth = items[0].offsetWidth + 15;
            const newIndex = Math.round(carousel.scrollLeft / itemWidth);
            if (newIndex !== currentIndex && newIndex < items.length) updateDots(newIndex);
        });

        function startAutoScroll() {
            autoScrollInterval = setInterval(() => {
                let nextIndex = (currentIndex + 1) % items.length;
                scrollToIndex(nextIndex);
            }, 4000);
        }

        function stopAutoScroll() { clearInterval(autoScrollInterval); }

        startAutoScroll();
        carousel.addEventListener('touchstart', stopAutoScroll, { passive: true });
        carousel.addEventListener('mousedown', stopAutoScroll);
        carousel.addEventListener('touchend', () => { setTimeout(startAutoScroll, 5000); });
    }
});