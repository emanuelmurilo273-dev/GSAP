// Biblioteca própria de fotos profissionais por segmento (Unsplash License: uso comercial
// gratuito; crédito exibido por cortesia). Arquivos em /stock/<segmento>-<n>-<800|1600>.webp,
// selecionados manualmente: capa na horizontal, "sobre" na vertical, sem marcas nem closes de rosto.
import type { SiteImage } from "./types";

type Entry = [alt: string, author: string, w: number, h: number];

export const STOCK: Record<string, Entry[]> = {
 "barbearia": [
  [
   "Cadeira de barbeiro de couro preto diante de parede de tijolos",
   "Nathon Oski",
   1600,
   1063
  ],
  [
   "Cadeira de barbeiro preta e prata",
   "Joshua Lawrence",
   1600,
   2000
  ],
  [
   "Máquinas de corte, tesoura, pente e produtos sobre bancada",
   "Andrea Donato",
   1600,
   1067
  ],
  [
   "Barbeiros cortando cabelo em barbearia moderna",
   "Chaps & Co",
   1600,
   2000
  ],
  [
   "Interior de barbearia com cadeiras e espelhos",
   "Barney Goodman",
   1600,
   1096
  ],
  [
   "Salão com luminárias pendentes acesas",
   "Jason Leung",
   1600,
   2400
  ],
  [
   "Cadeiras de barbeiro e lavatórios em ambiente de luz baixa",
   "T",
   1600,
   2392
  ]
 ],
 "salao": [
  [
   "Salão de beleza moderno com cadeiras pretas e espelhos redondos",
   "Benyamin Bohlouli",
   1600,
   1067
  ],
  [
   "Cabeleireira fazendo penteado em cliente",
   "Alexander Mass",
   1600,
   2400
  ],
  [
   "Cadeiras de salão diante de espelhos circulares",
   "Greg Trowman",
   1600,
   1111
  ],
  [
   "Cabeleireira fazendo escova no cabelo da cliente",
   "Adam Winger",
   1600,
   1068
  ],
  [
   "Mãos segurando escovas, tesoura e pincel de coloração",
   "Adam Winger",
   1600,
   1068
  ],
  [
   "Modelador de cachos em uso",
   "Baylee Gramling",
   1600,
   2847
  ]
 ],
 "restaurante": [
  [
   "Salão do restaurante com mesas de madeira e luz baixa",
   "Unsplash",
   1600,
   1067
  ],
  [
   "Salão elegante com mesas postas",
   "Archee Lal",
   1600,
   2400
  ],
  [
   "Mesa posta para o jantar",
   "Unsplash",
   1600,
   1067
  ],
  [
   "Massa ao molho de carne com queijo ralado",
   "Ben Lei",
   1600,
   1600
  ],
  [
   "Pizza artesanal sobre tábua",
   "Unsplash",
   1600,
   1933
  ],
  [
   "Restaurante aconchegante com mesas",
   "Antonio Araujo",
   1600,
   1067
  ],
  [
   "Prato de massa em tigela preta",
   "Nicholas Grande",
   1600,
   2400
  ],
  [
   "Restaurante movimentado com bar e iluminação decorativa",
   "hiding ninja",
   1600,
   1067
  ]
 ],
 "odontologia": [
  [
   "Consultório odontológico moderno com cadeira e equipamentos",
   "Benyamin Bohlouli",
   1600,
   1070
  ],
  [
   "Mão com luva segurando instrumentos odontológicos",
   "Katarzyna Zygnerska",
   1600,
   2400
  ],
  [
   "Cadeira odontológica em consultório claro",
   "Atikah Akhtar",
   1600,
   1067
  ],
  [
   "Modelo de implante dentário",
   "Jonathan Borba",
   1600,
   1067
  ],
  [
   "Dentista analisando radiografias",
   "Jonathan Borba",
   1600,
   1067
  ],
  [
   "Sala de espera moderna",
   "Amy Vosters",
   1600,
   1872
  ]
 ],
 "clinica": [
  [
   "Recepção de clínica",
   "Martha Dominguez de Gouveia",
   1600,
   1089
  ],
  [
   "Paciente aguardando em sala de espera moderna",
   "Caroline Badran",
   1600,
   2328
  ],
  [
   "Médico conversando com paciente no consultório",
   "Vitaly Gariev",
   1600,
   900
  ],
  [
   "Estetoscópio sobre a mesa",
   "Hush Naidoo Jade Photography",
   1600,
   1067
  ],
  [
   "Sala de espera moderna da clínica",
   "Amy Vosters",
   1600,
   1872
  ],
  [
   "Consulta médica no consultório",
   "Vitaly Gariev",
   1600,
   900
  ]
 ],
 "academia": [
  [
   "Área de musculação com bancos e equipamentos",
   "Samuel Girven",
   1600,
   1067
  ],
  [
   "Acessórios de treino organizados na parede",
   "Caroline Badran",
   1600,
   2400
  ],
  [
   "Academia moderna com esteiras e janelas amplas",
   "Aalo Lens",
   1600,
   900
  ],
  [
   "Halteres organizados no suporte",
   "Samuel Girven",
   1600,
   2400
  ],
  [
   "Esteiras diante de janelas",
   "Aalo Lens",
   1600,
   900
  ],
  [
   "Fileira de aparelhos de musculação",
   "Mohamed Fareed",
   1600,
   2403
  ]
 ],
 "oficina": [
  [
   "Mecânico trabalhando no motor",
   "Dextar Studio",
   1600,
   1067
  ],
  [
   "Mecânico consertando motor",
   "Sten Rademaker",
   1600,
   2400
  ],
  [
   "Carros em manutenção na oficina",
   "Winston Chen",
   1600,
   1067
  ],
  [
   "Mecânico inspecionando o motor com o capô aberto",
   "Dextar Studio",
   1600,
   1067
  ],
  [
   "Mãos com chave trabalhando no motor",
   "Christian Buehner",
   1600,
   1200
  ],
  [
   "Motor do carro em detalhe",
   "Chad Kirchoff",
   1600,
   900
  ],
  [
   "Painel e velocímetro do carro",
   "CHUTTERSNAP",
   1600,
   1068
  ]
 ],
 "roupas": [
  [
   "Loja com araras de roupas",
   "Luca",
   1600,
   1067
  ],
  [
   "Roupas em arara de boutique",
   "Polina Kuzovkova",
   1600,
   2400
  ],
  [
   "Boutique com araras, plantas e luz quente",
   "Jie Yeu Teoh",
   1600,
   1061
  ],
  [
   "Boutique com roupas penduradas",
   "Clark Street Mercantile",
   1600,
   1068
  ],
  [
   "Interior da loja de roupas",
   "Clark Street Mercantile",
   1600,
   1068
  ],
  [
   "Suéteres coloridos na arara",
   "Markus Winkler",
   1600,
   2400
  ]
 ],
 "imobiliaria": [
  [
   "Casa com piscina e espreguiçadeiras",
   "Salman Saqib",
   1600,
   900
  ],
  [
   "Sala de estar com vista",
   "Caroline Badran",
   1600,
   2265
  ],
  [
   "Casa moderna com piscina e gramado",
   "Salvo Media LLC",
   1600,
   1067
  ],
  [
   "Cozinha integrada com janelas amplas",
   "Caroline Badran",
   1600,
   982
  ],
  [
   "Sala ampla com sofá",
   "Maverick Frame",
   1600,
   1067
  ],
  [
   "Fachada de casa moderna iluminada",
   "Arthur BAUDRY",
   1600,
   1244
  ],
  [
   "Casa moderna com janelas amplas e jardim",
   "Aalo Lens",
   1600,
   900
  ],
  [
   "Sobrado com varandas",
   "Naksha Banwao",
   1600,
   1600
  ]
 ],
 "servicos": [
  [
   "Equipe trabalhando em mesa com notebooks",
   "Christina @ wocintechchat.com",
   1600,
   1068
  ],
  [
   "Profissionais colaborando em reunião",
   "Vitaly Gariev",
   1600,
   900
  ],
  [
   "Apresentação para a equipe",
   "Vitaly Gariev",
   1600,
   900
  ],
  [
   "Reunião em escritório moderno",
   "Vitaly Gariev",
   1600,
   900
  ],
  [
   "Apresentação em escritório moderno",
   "Vitaly Gariev",
   1600,
   900
  ],
  [
   "Reunião de trabalho",
   "Mario Gogh",
   1600,
   1067
  ]
 ],
 "petshop": [
  [
   "Cachorro pequeno sendo tosado",
   "Buddy AN",
   1600,
   1067
  ],
  [
   "Cachorro de pelo branco com bandana",
   "Freya Song",
   1600,
   2400
  ],
  [
   "Filhote correndo na grama",
   "Joe Caione",
   1600,
   1067
  ],
  [
   "Filhote de corgi feliz",
   "Cham Pets Family",
   1600,
   1200
  ],
  [
   "Cachorro descansando na grama",
   "Ralu Gal",
   1600,
   2133
  ],
  [
   "Dois cachorros felizes em frente a flores",
   "Alvan Nee",
   1600,
   2400
  ],
  [
   "Mãos fazendo carinho em cachorro",
   "Vinícius Costa",
   1600,
   1067
  ]
 ],
 "padaria": [
  [
   "Pães na vitrine",
   "Yeh Xintong",
   1600,
   1068
  ],
  [
   "Bolinho confeitado",
   "Deva Williamson",
   1600,
   2400
  ],
  [
   "Pães em cesta de vime",
   "mohamed hassouna",
   1600,
   900
  ],
  [
   "Croissants sobre a mesa",
   "Conor Brown",
   1600,
   1067
  ],
  [
   "Massa sendo preparada com rolo",
   "Nadya Spetnitskaya",
   1600,
   1067
  ],
  [
   "Vitrine de doces",
   "Nerissa J",
   1600,
   1067
  ],
  [
   "Tortas e bolos na vitrine",
   "Ulysse Pointcheval",
   1600,
   2400
  ],
  [
   "Café com mesas e decoração",
   "Aleksandra Dementeva",
   1600,
   1200
  ]
 ],
 "construcao": [
  [
   "Guindastes sobre canteiro de obras ao entardecer",
   "Samuel Regan-Asante",
   1600,
   901
  ],
  [
   "Prédio em construção",
   "Tolu Olubode",
   1600,
   1941
  ],
  [
   "Profissional inspecionando a armação de aço",
   "Toni Reed",
   1600,
   1063
  ],
  [
   "Equipe concretando a laje",
   "Hammilton Ojijo",
   1600,
   1280
  ],
  [
   "Guindastes sobre os prédios",
   "EJ Yao",
   1600,
   1068
  ],
  [
   "Edifícios sob céu azul",
   "C Dustin",
   1600,
   900
  ],
  [
   "Guindaste visto de baixo",
   "James Sullivan",
   1600,
   2000
  ]
 ]
};

/**
 * Fotos ilustrativas do segmento, em ordem própria para cada empresa (`seedKey`):
 * a capa é sempre uma foto horizontal e o "sobre" prefere uma vertical.
 * `base` é o prefixo público ("" no app do Claude, APP_URL + "/" no servidor).
 */
export function stockImages(segment: string, base = "", seedKey = ""): SiteImage[] {
  const key = STOCK[segment] ? segment : "servicos";
  const list = STOCK[key]!.map((e, n) => ({ e, n }));
  let h = 2166136261;
  for (let i = 0; i < seedKey.length; i++) h = Math.imul(h ^ seedKey.charCodeAt(i), 16777619);
  const seed = h >>> 0;
  const landscape = list.filter((x) => x.e[2] >= x.e[3]);
  const portrait = list.filter((x) => x.e[2] < x.e[3]);
  const hero = (landscape.length ? landscape : list)[seed % (landscape.length || list.length)]!;
  const rest = list.filter((x) => x !== hero);
  const aboutPool = portrait.filter((x) => x !== hero);
  const about = aboutPool.length ? aboutPool[(seed >>> 8) % aboutPool.length]! : rest[0]!;
  const others = rest.filter((x) => x !== about);
  const shift = others.length ? (seed >>> 16) % others.length : 0;
  const ordered = [hero, about, ...others.slice(shift), ...others.slice(0, shift)];
  return ordered.map(({ e: [alt, author], n }) => ({
    url: `${base}stock/${key}-${n}-1600.webp`,
    alt,
    credit: { name: author, link: "https://unsplash.com", source: "unsplash" as const },
  }));
}
