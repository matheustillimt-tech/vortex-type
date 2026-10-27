import type { Formulario } from "./tipos";

/** Roteiro de exemplo que nasce em todo formulário novo (o painel copia daqui). */
export const EXEMPLO: Formulario = {
  id: "00000000-0000-4000-8000-000000000001",
  slug: "aplicacao",
  nome: "Sua Empresa · Aplicação",
  ativo: true,
  titulo_pagina: "Fale com a gente · Sua Empresa",
  descricao: "Em 1 minuto, algumas informações sobre o seu negócio pra gente preparar a sua reunião.",
  logo_url: null,
  avatar_url: null,
  cores: {},
  textos: {},
  privacidade_url: null,
  termos_url: null,
  pixels: {},
  agendamento: null,
  criado_em: "2026-10-21T20:00:00Z",
  atualizado_em: "2026-10-21T20:00:00Z",
  perguntas: [
    {
      slug: "nome",
      tipo: "texto",
      papel: "nome",
      texto: "Então vamos começar! Qual é o seu nome completo?",
      rotulo: "NOME COMPLETO",
      placeholder: "Digite seu nome e sobrenome",
      bolhas: [
        "Oi! Que bom ter você aqui. São só algumas perguntas rápidas sobre o seu negócio.",
        "Com elas, a gente já chega na reunião sabendo como pode te ajudar.",
      ],
    },
    { slug: "whatsapp", tipo: "telefone", papel: "whatsapp", texto: "Qual é o seu Whatsapp?", rotulo: "WHATSAPP", placeholder: "Seu WhatsApp com DDD" },
    { slug: "empresa", tipo: "texto", papel: "empresa", texto: "Qual é o nome da sua empresa?", placeholder: "Digite o nome da sua empresa" },
    {
      slug: "segmento",
      tipo: "escolha",
      papel: "nicho",
      texto: "Qual é o seu segmento?",
      opcoes: [
        "Agência de Marketing", "Agronegócio", "Alimentação e bebidas", "Automotivo", "Beleza e estética", "Construção e engenharia",
        "Consultoria", "E-commerce", "Educação", "Energia Solar", "Eventos", "Finanças", "Hotelaria", "Imobiliário", "Indústria",
        "Jurídico", "Logística e transporte", "Moda e vestuário", "Prestação de serviços", "Seguradora", "Tecnologia", "Saúde", "Outro",
      ],
      outro: { rotulo: "SEU SEGMENTO", placeholder: "Conta pra gente qual é o seu segmento..." },
    },
    {
      slug: "cargo",
      tipo: "escolha",
      papel: "cargo",
      texto: "Qual é o seu cargo na empresa?",
      opcoes: ["Sócio ou Fundador", "Presidente ou CEO", "C-Level", "Diretor", "Gerente", "Analista", "Outro"],
    },
    {
      slug: "faturamento",
      tipo: "escolha",
      papel: "faturamento",
      texto: "Qual é o faturamento anual da sua empresa?",
      opcoes: [
        "Não faturo", "Até R$ 60 mil", "R$ 60 mil a R$ 250 mil", "R$ 250 mil a R$ 500 mil", "R$ 500 mil a R$ 1 milhão",
        "R$ 1 milhão a R$ 2,5 milhões", "R$ 2,5 milhões a R$ 5 milhões", "R$ 5 milhões a R$ 10 milhões", "R$ 10 milhões a R$ 25 milhões",
        "Acima de R$ 25 milhões",
      ],
    },
    { slug: "email", tipo: "email", papel: "email", texto: "Qual é o seu melhor e-mail?", rotulo: "E-MAIL", placeholder: "voce@email.com" },
  ],
};
