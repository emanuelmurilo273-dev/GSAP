// Script dos sites gerados (sem dependências; compatível com navegadores atuais e degrada sem JS).
export const SITE_SCRIPT = `(function(){
var d=document,top=d.getElementById('top'),pg=d.getElementById('pg'),forceSolid=top&&top.hasAttribute('data-solid');
function onScroll(){var y=window.pageYOffset||0;if(top)top.classList.toggle('solid',forceSolid||y>40);if(pg){var h=d.documentElement.scrollHeight-innerHeight;pg.style.transform='scaleX('+(h>0?Math.min(1,y/h):0)+')';}}
addEventListener('scroll',onScroll,{passive:true});onScroll();
/* Menu do celular */
var bt=d.getElementById('burger'),nav=d.getElementById('menu');
function setNav(o){d.documentElement.classList.toggle('nav-open',o);if(bt){bt.setAttribute('aria-expanded',o);bt.setAttribute('aria-label',o?'Fechar menu':'Abrir menu');}}
if(bt){bt.addEventListener('click',function(){setNav(bt.getAttribute('aria-expanded')!=='true')});}
if(nav){nav.addEventListener('click',function(e){if(e.target.closest('a'))setNav(false)});}
d.addEventListener('keydown',function(e){if(e.key==='Escape'&&d.documentElement.classList.contains('nav-open')){setNav(false);bt&&bt.focus();}});
/* Animações ao rolar */
var els=[].slice.call(d.querySelectorAll('.rv'));
if('IntersectionObserver' in window){var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target)}})},{threshold:.1,rootMargin:'0px 0px -40px 0px'});els.forEach(function(e){io.observe(e)});}else els.forEach(function(e){e.classList.add('in')});
setTimeout(function(){els.forEach(function(e){if(e.getBoundingClientRect().top<innerHeight)e.classList.add('in')})},400);
/* Abas do cardápio (teclado: setas, Home, End) */
[].forEach.call(d.querySelectorAll('.tabs'),function(t){var tabs=[].slice.call(t.querySelectorAll('[role=tab]')),sec=t.closest('section');
function act(b,focus){tabs.forEach(function(x){var on=x===b;x.classList.toggle('on',on);x.setAttribute('aria-selected',on);x.tabIndex=on?0:-1});[].forEach.call(sec.querySelectorAll('.menu-panel'),function(p){var on=p.getAttribute('data-panel')===b.getAttribute('data-tab');p.classList.toggle('on',on);if(on)[].forEach.call(p.querySelectorAll('.rv'),function(e){e.classList.add('in')})});if(focus)b.focus();}
t.addEventListener('click',function(e){var b=e.target.closest('[role=tab]');if(b)act(b)});
t.addEventListener('keydown',function(e){var i=tabs.indexOf(d.activeElement);if(i<0)return;var n=e.key==='ArrowRight'?i+1:e.key==='ArrowLeft'?i-1:e.key==='Home'?0:e.key==='End'?tabs.length-1:null;if(n===null)return;e.preventDefault();act(tabs[(n+tabs.length)%tabs.length],true)});});
/* Horário de hoje */
var days=['domingo','segunda','terça','quarta','quinta','sexta','sábado'],today=days[new Date().getDay()];
[].forEach.call(d.querySelectorAll('.hours div[data-day]'),function(x){if(x.getAttribute('data-day').indexOf(today)===0)x.classList.add('today')});
[].forEach.call(d.querySelectorAll('.hc-foot[data-hours]'),function(f){try{JSON.parse(f.getAttribute('data-hours')).forEach(function(l){if(l.label.toLowerCase().indexOf(today)===0)f.querySelector('.hc-today').textContent='Hoje: '+l.value})}catch(e){}});
/* Formulário de orçamento: validação acessível e estados */
[].forEach.call(d.querySelectorAll('form.quote'),function(f){
  var st=f.querySelector('.form-status'),btn=f.querySelector('button[type=submit]');
  function msgFor(el){var v=el.value.trim();if(el.name==='nome'){if(!v)return 'Informe seu nome.';if(v.length<2)return 'O nome precisa ter pelo menos 2 letras.';}
    if(el.name==='telefone'&&v){var dg=v.replace(/\\D/g,'');if(dg.length<10||dg.length>13)return 'Informe um telefone com DDD, ex.: (11) 91234-5678.';}
    if(el.name==='mensagem'){if(!v)return 'Conte o que você precisa.';if(v.length<10)return 'Escreva um pouco mais (pelo menos 10 caracteres).';}return '';}
  function check(el){var m=msgFor(el),er=d.getElementById(el.id+'-err');el.setAttribute('aria-invalid',m?'true':'false');if(er)er.textContent=m;return !m;}
  [].forEach.call(f.elements,function(el){if(el.name){el.addEventListener('blur',function(){if(el.value)check(el)});el.addEventListener('input',function(){if(el.getAttribute('aria-invalid')==='true')check(el)});}});
  f.addEventListener('submit',function(e){e.preventDefault();st.className='form-status';st.textContent='';
    var fields=[].filter.call(f.elements,function(el){return el.name}),bad=fields.filter(function(el){return !check(el)});
    if(bad.length){bad[0].focus();st.className='form-status fail';st.textContent='Corrija o'+(bad.length>1?'s campos destacados':' campo destacado')+' para continuar.';return;}
    var v=function(n){return f.elements[n].value.trim()};
    var msg='Olá! Meu nome é '+v('nome')+'. Vim pelo site da '+f.dataset.biz+'.'+(v('telefone')?' Meu WhatsApp: '+v('telefone')+'.':'')+'\\n\\n'+v('mensagem');
    btn.setAttribute('aria-busy','true');
    var url=f.dataset.wa?'https://wa.me/'+f.dataset.wa+'?text='+encodeURIComponent(msg):'mailto:'+f.dataset.email+'?subject='+encodeURIComponent('Pedido de orçamento')+'&body='+encodeURIComponent(msg);
    var w=f.dataset.wa?window.open(url,'_blank','noopener'):null;
    if(!f.dataset.wa){location.href=url;}
    setTimeout(function(){btn.removeAttribute('aria-busy');
      if(f.dataset.wa&&!w){st.className='form-status fail';st.innerHTML='';st.append('Não conseguimos abrir o WhatsApp automaticamente. ');var a=d.createElement('a');a.href=url;a.target='_blank';a.rel='noopener noreferrer';a.textContent='Toque aqui para abrir a conversa';st.append(a);}
      else{st.className='form-status ok';st.textContent=f.dataset.wa?'Pronto! Sua mensagem foi aberta no WhatsApp. Confira e toque em enviar.':'Pronto! Sua mensagem foi aberta no seu aplicativo de e-mail.';f.reset();}
    },350);
  });
});
var yr=d.getElementById('yr');if(yr)yr.textContent=new Date().getFullYear();
})();`;
