/**
 * Multissegmento (S1): a DLJ Innovations atende vários nichos de agendamento, não só
 * barbearia. Cada segmento é uma configuração com vocabulário, serviços de
 * exemplo, tipo de negócio pro Google (JSON-LD), conteúdo da página de venda
 * (/para/[slug]) e os recursos ligados ou desligados.
 *
 * Arquivo puro (sem banco): usado por Server e Client Components e pelos testes.
 * O segmento do salão fica em `Salon.segment` (string, validada aqui).
 *
 * Ondas:
 *  1 — beleza e bem-estar: o que já existe na DLJ Innovations serve quase sem adaptação.
 *  2 — serviços: o fluxo é o mesmo, mas a "agenda" nem sempre é uma pessoa.
 *  3 — saúde: até o horário marcado é dado sensível (LGPD, art. 11). Roda no
 *      modo discreto (src/lib/discreet.ts). Revisão jurídica dos textos ainda pendente.
 *
 * `available` decide se o segmento aparece no cadastro e tem página de venda
 * (hoje os 18 estão abertos; segmento novo pode nascer fechado até estar pronto).
 * Os recursos em `features` marcados como "planejado" são só configuração por
 * enquanto — a implementação vem nas etapas S3/S4 do roadmap.
 */

export const SEGMENT_SLUGS = [
  "barbearia",
  "cabeleireira",
  "manicure",
  "lash-designer",
  "sobrancelhas",
  "maquiadora",
  "esteticista",
  "depiladora",
  "massoterapeuta",
  "podologa",
  "personal-trainer",
  "professor-particular",
  "pet-shop",
  "lava-jato",
  "psicologo",
  "fisioterapeuta",
  "dentista",
  "medico",
] as const;

export type SegmentSlug = (typeof SEGMENT_SLUGS)[number];

/** Segmento de quem já usava a DLJ Innovations antes do multissegmento. */
export const DEFAULT_SEGMENT: SegmentSlug = "barbearia";

export type SegmentWave = 1 | 2 | 3;

/** Palavras que mudam de um nicho pro outro. Sempre em minúsculas — use `cap()` no início de frase/título. */
export type SegmentVocab = {
  /** "cliente", "paciente", "aluno", "tutor" */
  client: string;
  clients: string;
  /** "atendimento", "sessão", "aula", "consulta" */
  appointment: string;
  appointments: string;
  /** "profissional", "banhista", "box" */
  professional: string;
  professionals: string;
  /** Como o negócio se chama: "barbearia", "salão", "consultório", "estúdio" */
  business: string;
  businessGender: "m" | "f";
  /** Gênero de "atendimento/sessão/aula": define "o/a", "esse/essa", "nenhum/nenhuma". */
  appointmentGender: "m" | "f";
};

export type SegmentService = { name: string; durationMinutes: number; priceCents: number };

export type SegmentFeatures = {
  /** Planejado (S3): atendimento na casa do cliente. */
  home: boolean;
  /** Planejado (S3): atendimento online. */
  online: boolean;
  /** Planejado (S4): ficha extra do cliente (pet ou veículo). */
  clientProfile: "pet" | "vehicle" | null;
  /** Planejado (S4): lembretes e telas sem citar o serviço. */
  discreet: boolean;
  /** Retorno periódico sugerido, em dias (manutenção de lash, depilação...). Planejado (agendamento recorrente). */
  returnEveryDays: number | null;
};

export type SegmentLanding = {
  /** <title> da página de venda */
  title: string;
  headline: string;
  subheadline: string;
  pains: { icon: string; title: string; body: string }[];
  /** Exemplos de serviços que o nicho agenda (aparecem como "chips") */
  examples: string[];
  faq: { q: string; a: string }[];
};

export type SegmentConfig = {
  slug: SegmentSlug;
  wave: SegmentWave;
  /** Aparece no cadastro e tem página de venda. */
  available: boolean;
  /** Nome do segmento pra pessoa escolher: "Manicure / nail designer" */
  label: string;
  emoji: string;
  vocab: SegmentVocab;
  /** Serviços criados quando o dono pede os "serviços de exemplo" no cadastro. */
  sampleServices: SegmentService[];
  /** Tipo schema.org do JSON-LD da página pública (SEO/AEO). */
  schemaType: string;
  features: SegmentFeatures;
  landing: SegmentLanding;
};

const NO_FEATURES: SegmentFeatures = { home: false, online: false, clientProfile: null, discreet: false, returnEveryDays: null };

const v = (
  client: string,
  clients: string,
  appointment: string,
  appointments: string,
  professional: string,
  professionals: string,
  business: string,
  businessGender: "m" | "f"
): SegmentVocab => ({
  client,
  clients,
  appointment,
  appointments,
  professional,
  professionals,
  business,
  businessGender,
  appointmentGender: ["sessão", "aula", "consulta", "lavagem"].includes(appointment) ? "f" : "m",
});

const s = (name: string, durationMinutes: number, price: number): SegmentService => ({
  name,
  durationMinutes,
  priceCents: Math.round(price * 100),
});

const commonPains = {
  phone: {
    icon: "📵",
    title: "Cliente chama no WhatsApp enquanto você atende",
    body: "Com o link de agendamento, a pessoa escolhe o horário sozinha, a qualquer hora, sem você parar o que está fazendo.",
  },
  noShow: {
    icon: "👻",
    title: "Marcou e não apareceu",
    body: "A confirmação de presença avisa antes do horário e libera a vaga se a pessoa não confirmar.",
  },
  paper: {
    icon: "📒",
    title: "Agenda de caderno ou planilha",
    body: "Uma agenda só, com bloqueios de folga, histórico e métricas — sem conferir no papel.",
  },
};

export const SEGMENTS: Record<SegmentSlug, SegmentConfig> = {
  // ---------------------------------------------------------------- Onda 1
  barbearia: {
    slug: "barbearia",
    wave: 1,
    available: true,
    label: "Barbearia",
    emoji: "💈",
    vocab: v("cliente", "clientes", "atendimento", "atendimentos", "profissional", "profissionais", "barbearia", "f"),
    sampleServices: [s("Corte masculino", 30, 40), s("Barba", 20, 30), s("Corte + barba", 50, 65)],
    schemaType: "BarberShop",
    features: NO_FEATURES,
    landing: {
      title: "Agendamento online para barbearia",
      headline: "A agenda da sua barbearia cheia, sem ficar no WhatsApp",
      subheadline:
        "Seu cliente marca corte e barba pelo seu link, escolhe o barbeiro e o horário livre. Você só atende.",
      pains: [
        commonPains.phone,
        { ...commonPains.noShow, body: "Confirmação automática antes do horário e vaga liberada pra quem estiver na fila de espera do balcão." },
        { icon: "💈", title: "Cada barbeiro com a sua agenda", body: "Cada profissional vê só os próprios horários, com comissão calculada por atendimento." },
      ],
      examples: ["Corte masculino", "Barba", "Corte + barba", "Sobrancelha", "Pezinho", "Pigmentação"],
      faq: [
        { q: "Meus barbeiros precisam ter conta?", a: "Só se você quiser: o profissional pode entrar para ver a própria agenda, mas o dono consegue gerenciar tudo sozinho." },
        { q: "Dá pra receber o sinal por Pix?", a: "Você cadastra a chave Pix da barbearia e o cliente vê no agendamento. A confirmação automática de pagamento está no roadmap." },
      ],
    },
  },
  cabeleireira: {
    slug: "cabeleireira",
    wave: 1,
    available: true,
    label: "Cabeleireira / salão",
    emoji: "💇‍♀️",
    vocab: v("cliente", "clientes", "atendimento", "atendimentos", "profissional", "profissionais", "salão", "m"),
    sampleServices: [s("Corte feminino", 60, 80), s("Escova", 45, 50), s("Coloração", 120, 180), s("Hidratação", 60, 90)],
    schemaType: "HairSalon",
    features: NO_FEATURES,
    landing: {
      title: "Agendamento online para salão de beleza e cabeleireira",
      headline: "Seu salão com a agenda organizada e o telefone em paz",
      subheadline:
        "Serviços longos como coloração e mechas com a duração certa, cada profissional com a sua agenda e confirmação de presença automática.",
      pains: [
        { ...commonPains.phone, title: "O telefone toca no meio da progressiva" },
        { icon: "⏱️", title: "Serviço longo bagunça os horários", body: "Cada serviço tem a sua duração, então a agenda só mostra encaixes que realmente cabem." },
        commonPains.noShow,
      ],
      examples: ["Corte", "Escova", "Coloração", "Mechas", "Hidratação", "Progressiva"],
      faq: [
        { q: "Posso ter várias cabeleireiras no mesmo salão?", a: "Sim. Cada uma tem os próprios horários e serviços, e a cliente escolhe com quem quer ser atendida." },
        { q: "Funciona pra quem trabalha sozinha?", a: "Funciona. É só cadastrar você como a única profissional." },
      ],
    },
  },
  manicure: {
    slug: "manicure",
    wave: 1,
    available: true,
    label: "Manicure / nail designer",
    emoji: "💅",
    vocab: v("cliente", "clientes", "atendimento", "atendimentos", "profissional", "profissionais", "estúdio", "m"),
    sampleServices: [s("Mão", 40, 35), s("Pé", 50, 40), s("Mão + pé", 90, 70), s("Alongamento em gel", 120, 150)],
    schemaType: "NailSalon",
    features: { ...NO_FEATURES, home: true },
    landing: {
      title: "Agendamento online para manicure e nail designer",
      headline: "Chega de combinar horário de unha por mensagem",
      subheadline:
        "A cliente escolhe mão, pé ou alongamento, vê o horário livre e confirma sozinha. Você recebe tudo organizado.",
      pains: [
        { ...commonPains.phone, title: "Mensagem toda hora pra marcar unha" },
        commonPains.noShow,
        { icon: "🗒️", title: "Esqueceu o que a cliente costuma fazer", body: "O histórico mostra os atendimentos anteriores de cada cliente." },
      ],
      examples: ["Mão", "Pé", "Mão + pé", "Esmaltação em gel", "Alongamento", "Manutenção"],
      faq: [
        { q: "Atendo em casa, funciona?", a: "O agendamento funciona do mesmo jeito. O campo de endereço do atendimento a domicílio está planejado." },
        { q: "Posso vender pacotes de atendimento?", a: "Sim, a DLJ Innovations já tem pacotes de sessões com controle de saldo." },
      ],
    },
  },
  "lash-designer": {
    slug: "lash-designer",
    wave: 1,
    available: true,
    label: "Lash designer",
    emoji: "👁️",
    vocab: v("cliente", "clientes", "atendimento", "atendimentos", "profissional", "profissionais", "estúdio", "m"),
    sampleServices: [s("Extensão de cílios (fio a fio)", 120, 180), s("Volume russo", 150, 230), s("Manutenção (15 dias)", 75, 110), s("Remoção", 30, 50)],
    schemaType: "BeautySalon",
    features: { ...NO_FEATURES, returnEveryDays: 18 },
    landing: {
      title: "Agendamento online para lash designer",
      headline: "Manutenção de cílios agendada sem você lembrar de cobrar",
      subheadline:
        "Cada técnica com a duração certa e a cliente marcando a manutenção pelo seu link. O retorno a cada 15–20 dias fica fácil de acompanhar.",
      pains: [
        { icon: "🔁", title: "A cliente esquece de voltar", body: "O histórico mostra quando foi o último atendimento. O agendamento recorrente está no roadmap." },
        { ...commonPains.noShow, title: "Falta em horário de 2 horas" },
        commonPains.phone,
      ],
      examples: ["Fio a fio", "Volume russo", "Manutenção", "Remoção", "Lash lifting"],
      faq: [
        { q: "Dá pra ter duração diferente por técnica?", a: "Sim. Cada serviço tem a própria duração e o preço." },
        { q: "A DLJ Innovations avisa a cliente de voltar para manutenção?", a: "O lembrete de retorno automático faz parte do agendamento recorrente, que vem em seguida." },
      ],
    },
  },
  sobrancelhas: {
    slug: "sobrancelhas",
    wave: 1,
    available: true,
    label: "Design de sobrancelhas",
    emoji: "✨",
    vocab: v("cliente", "clientes", "atendimento", "atendimentos", "profissional", "profissionais", "estúdio", "m"),
    sampleServices: [s("Design de sobrancelhas", 30, 40), s("Design com henna", 45, 55), s("Micropigmentação", 120, 450), s("Retoque", 60, 150)],
    schemaType: "BeautySalon",
    features: { ...NO_FEATURES, returnEveryDays: 20 },
    landing: {
      title: "Agendamento online para design de sobrancelhas",
      headline: "Sua agenda de sobrancelhas sempre em ordem",
      subheadline: "Atendimentos rápidos precisam de uma agenda ágil: a cliente marca sozinha e você encaixa sem conversa.",
      pains: [commonPains.phone, { ...commonPains.noShow, title: "Horário curto perdido é prejuízo" }, commonPains.paper],
      examples: ["Design", "Design com henna", "Micropigmentação", "Retoque", "Brow lamination"],
      faq: [
        { q: "Posso trabalhar sozinha?", a: "Sim. Basta cadastrar você como única profissional." },
        { q: "A cliente precisa baixar algum app?", a: "Não. Ela abre o seu link no navegador e escolhe o horário." },
      ],
    },
  },
  maquiadora: {
    slug: "maquiadora",
    wave: 1,
    available: true,
    label: "Maquiadora",
    emoji: "💄",
    vocab: v("cliente", "clientes", "atendimento", "atendimentos", "profissional", "profissionais", "estúdio", "m"),
    sampleServices: [s("Maquiagem social", 60, 150), s("Maquiagem de noiva", 120, 450), s("Maquiagem + penteado", 150, 350), s("Aula de automaquiagem", 90, 200)],
    schemaType: "BeautySalon",
    features: { ...NO_FEATURES, home: true },
    landing: {
      title: "Agendamento online para maquiadora",
      headline: "Datas de eventos e atendimentos sem confusão",
      subheadline: "Maquiagem social, noivas e aulas, cada uma com a duração certa. Você bloqueia os dias de evento e o link nunca marca em cima.",
      pains: [
        { icon: "🗓️", title: "Dia de evento e agenda bagunçada", body: "Bloqueios por dia ou por horário impedem agendamentos em datas que você não atende." },
        commonPains.phone,
        commonPains.noShow,
      ],
      examples: ["Social", "Noiva", "Maquiagem + penteado", "Madrinhas", "Aula de automaquiagem"],
      faq: [
        { q: "Atendo no local do evento, dá pra usar?", a: "Dá pra agendar o horário normalmente. O endereço do atendimento a domicílio está planejado." },
        { q: "Dá pra bloquear dias inteiros?", a: "Sim, a tela de bloqueios cuida de folgas, feriados e eventos." },
      ],
    },
  },
  esteticista: {
    slug: "esteticista",
    wave: 1,
    available: true,
    label: "Esteticista",
    emoji: "🧖‍♀️",
    vocab: v("cliente", "clientes", "sessão", "sessões", "profissional", "profissionais", "clínica", "f"),
    sampleServices: [s("Limpeza de pele", 75, 130), s("Drenagem linfática", 60, 120), s("Peeling", 60, 160), s("Pacote de 10 sessões", 60, 900)],
    schemaType: "BeautySalon",
    features: { ...NO_FEATURES, returnEveryDays: 30 },
    landing: {
      title: "Agendamento online para esteticista",
      headline: "Pacotes de sessões e agenda organizados no mesmo lugar",
      subheadline: "Controle quantas sessões cada cliente ainda tem, agende cada uma e veja quem precisa voltar.",
      pains: [
        { icon: "🎁", title: "Perder a conta das sessões do pacote", body: "Pacotes com saldo: cada sessão marcada desconta automaticamente." },
        commonPains.noShow,
        commonPains.phone,
      ],
      examples: ["Limpeza de pele", "Drenagem", "Peeling", "Massagem modeladora", "Pacotes de sessões"],
      faq: [
        { q: "A DLJ Innovations controla pacotes de sessões?", a: "Sim. Você define o pacote, vende para a cliente e o saldo diminui a cada sessão concluída." },
        { q: "Posso ter mais de uma sala ou profissional?", a: "Sim, cadastre cada profissional com os seus horários." },
      ],
    },
  },
  depiladora: {
    slug: "depiladora",
    wave: 1,
    available: true,
    label: "Depiladora",
    emoji: "🌸",
    vocab: v("cliente", "clientes", "atendimento", "atendimentos", "profissional", "profissionais", "espaço", "m"),
    sampleServices: [s("Depilação de pernas", 40, 60), s("Depilação de axilas", 15, 25), s("Depilação íntima", 30, 55), s("Pacote de 5 sessões", 40, 250)],
    schemaType: "BeautySalon",
    features: { ...NO_FEATURES, returnEveryDays: 28 },
    landing: {
      title: "Agendamento online para depiladora",
      headline: "Sua cliente volta no prazo certo, sem você correr atrás",
      subheadline: "Agendamento pelo link, pacotes de sessões e histórico para acompanhar o retorno periódico.",
      pains: [commonPains.phone, { icon: "🔁", title: "Cliente some depois da primeira vez", body: "O histórico mostra quem está há mais tempo sem voltar. O lembrete de retorno automático vem com o agendamento recorrente." }, commonPains.noShow],
      examples: ["Pernas", "Axilas", "Virilha", "Buço", "Pacote de sessões"],
      faq: [
        { q: "Posso vender pacote de sessões?", a: "Sim. Pacotes com saldo já fazem parte da DLJ Innovations." },
        { q: "As clientes veem meus preços?", a: "Sim, o link mostra serviço, duração e preço antes de marcar." },
      ],
    },
  },
  massoterapeuta: {
    slug: "massoterapeuta",
    wave: 1,
    available: true,
    label: "Massoterapeuta",
    emoji: "🙌",
    vocab: v("cliente", "clientes", "sessão", "sessões", "profissional", "profissionais", "espaço", "m"),
    sampleServices: [s("Massagem relaxante", 60, 120), s("Massagem terapêutica", 60, 140), s("Quick massage", 20, 50), s("Shiatsu", 60, 130)],
    schemaType: "HealthAndBeautyBusiness",
    features: { ...NO_FEATURES, home: true },
    landing: {
      title: "Agendamento online para massoterapeuta",
      headline: "Sessões de massagem agendadas sem troca de mensagens",
      subheadline: "O cliente escolhe a modalidade, vê a duração e marca o horário livre. Você foca na sessão.",
      pains: [commonPains.phone, commonPains.noShow, { icon: "⏱️", title: "Tempo entre sessões", body: "Cada serviço tem a duração certa, então a agenda respeita o intervalo entre uma sessão e outra." }],
      examples: ["Relaxante", "Terapêutica", "Quick massage", "Shiatsu", "Reflexologia"],
      faq: [
        { q: "Atendo em domicílio, dá pra usar?", a: "O agendamento funciona do mesmo jeito. O endereço do atendimento a domicílio está planejado." },
        { q: "Dá pra aceitar sinal?", a: "O cliente vê a chave Pix no agendamento. O sinal automático está no roadmap." },
      ],
    },
  },
  podologa: {
    slug: "podologa",
    wave: 1,
    available: true,
    label: "Podóloga",
    emoji: "🦶",
    vocab: v("cliente", "clientes", "atendimento", "atendimentos", "profissional", "profissionais", "clínica", "f"),
    sampleServices: [s("Podologia clínica", 60, 120), s("Tratamento de unha encravada", 45, 100), s("Pedicure podológica", 60, 90), s("Reflexologia podal", 45, 80)],
    schemaType: "HealthAndBeautyBusiness",
    // Fica na fronteira com saúde: usa o modo discreto, sem prontuário.
    features: { ...NO_FEATURES, discreet: true, returnEveryDays: 30 },
    landing: {
      title: "Agendamento online para podóloga",
      headline: "Agenda da podologia no piloto automático",
      subheadline: "O cliente marca pelo seu link, e a DLJ Innovations guarda só o necessário: agenda e contato, sem prontuário.",
      pains: [commonPains.phone, commonPains.noShow, { icon: "🔒", title: "Privacidade do cliente", body: "A plataforma não guarda prontuário nem ficha clínica, e o modo discreto faz os lembretes dizerem só “seu horário”, sem citar o serviço." }],
      examples: ["Podologia clínica", "Unha encravada", "Pedicure podológica", "Palmilhas", "Reflexologia"],
      faq: [
        { q: "A DLJ Innovations guarda prontuário?", a: "Não. A DLJ Innovations cuida da agenda, não do prontuário. Guarde as fichas clínicas no seu sistema próprio." },
        { q: "Posso receber pelo Pix?", a: "O cliente vê a chave Pix da sua clínica no agendamento." },
      ],
    },
  },
  // ---------------------------------------------------------------- Onda 2
  "personal-trainer": {
    slug: "personal-trainer",
    wave: 2,
    available: true,
    label: "Personal trainer",
    emoji: "🏋️",
    vocab: v("aluno", "alunos", "aula", "aulas", "profissional", "profissionais", "estúdio", "m"),
    sampleServices: [s("Treino individual", 60, 100), s("Avaliação física", 45, 80), s("Treino em dupla", 60, 150), s("Treino online", 45, 70)],
    schemaType: "HealthClub",
    features: { ...NO_FEATURES, home: true, online: true, returnEveryDays: 7 },
    landing: {
      title: "Agendamento online para personal trainer",
      headline: "Seus alunos marcam o treino, você foca na evolução deles",
      subheadline: "Horários de treino, avaliações e reposições organizados pelo link. Nada de planilha de horários.",
      pains: [
        { icon: "📲", title: "Aluno desmarca em cima da hora", body: "O aluno remarca ou cancela pelo link e o horário volta pra agenda automaticamente." },
        commonPains.phone,
        { icon: "🔁", title: "Treino toda semana, marcado toda semana", body: "O agendamento recorrente semanal está no roadmap." },
      ],
      examples: ["Treino individual", "Avaliação física", "Treino em dupla", "Treino online", "Consultoria"],
      faq: [
        { q: "Atendo em academia ou na casa do aluno, funciona?", a: "O agendamento funciona do mesmo jeito. A escolha de local e o atendimento online estão planejados." },
        { q: "Dá pra vender pacote de aulas?", a: "Sim. Pacotes de sessões com saldo já existem." },
      ],
    },
  },
  "professor-particular": {
    slug: "professor-particular",
    wave: 2,
    available: true,
    label: "Professor particular",
    emoji: "📚",
    vocab: v("aluno", "alunos", "aula", "aulas", "professor", "professores", "espaço de aulas", "m"),
    sampleServices: [s("Aula particular", 60, 80), s("Aula em dupla", 60, 120), s("Reforço escolar", 90, 100), s("Aula online", 60, 70)],
    schemaType: "EducationalOrganization",
    features: { ...NO_FEATURES, online: true, returnEveryDays: 7 },
    landing: {
      title: "Agendamento online para professor particular",
      headline: "Sua grade de aulas organizada, sem mensagem de ida e volta",
      subheadline: "Alunos escolhem o horário livre, remarcam sozinhos e você acompanha a presença de cada um.",
      pains: [
        commonPains.phone,
        { icon: "🔁", title: "Aula fixa toda semana", body: "O agendamento recorrente semanal está no roadmap." },
        commonPains.noShow,
      ],
      examples: ["Aula particular", "Reforço escolar", "Aula em dupla", "Preparação para provas", "Aula online"],
      faq: [
        { q: "Serve para aula online?", a: "O agendamento serve. O link da videochamada dentro do agendamento está planejado." },
        { q: "Os pais podem marcar pelo aluno?", a: "Sim. Quem abre o link informa nome e telefone, e pode ser o responsável." },
      ],
    },
  },
  "pet-shop": {
    slug: "pet-shop",
    wave: 2,
    available: true,
    label: "Pet shop (banho e tosa)",
    emoji: "🐶",
    vocab: v("tutor", "tutores", "atendimento", "atendimentos", "banhista", "banhistas", "pet shop", "m"),
    sampleServices: [s("Banho", 60, 60), s("Tosa higiênica", 30, 40), s("Banho e tosa", 120, 100), s("Hidratação de pelagem", 45, 50)],
    schemaType: "PetStore",
    features: { ...NO_FEATURES, clientProfile: "pet", returnEveryDays: 21 },
    landing: {
      title: "Agendamento online para pet shop e banho e tosa",
      headline: "Banho e tosa agendado pelo tutor, com a ficha do pet",
      subheadline:
        "O tutor informa nome, raça e porte do pet ao marcar, e o preço já aparece certo para o tamanho. Você sabe quem vem antes de ele chegar.",
      pains: [
        commonPains.phone,
        { icon: "🐾", title: "Preço muda com o porte", body: "Cada serviço pode ter um preço para pequeno, médio e grande — o tutor vê o valor certo antes de confirmar." },
        { ...commonPains.noShow, body: "Confirmação de presença antes do horário e vaga liberada se o tutor não confirmar." },
      ],
      examples: ["Banho", "Tosa higiênica", "Banho e tosa", "Hidratação", "Corte de unhas"],
      faq: [
        { q: "A ficha do pet fica guardada?", a: "Sim. Na próxima vez o tutor só confere os dados, e você vê o pet na agenda e no histórico do tutor." },
        { q: "Dá pra cobrar preço diferente por porte?", a: "Dá. Em cada serviço você define o preço de pequeno, médio e grande, e o faturamento já usa o valor do porte." },
        { q: "A agenda é por banhista ou por banheira?", a: "Cadastre cada banhista (ou cada banheira) como um profissional, com seus horários." },
      ],
    },
  },
  "lava-jato": {
    slug: "lava-jato",
    wave: 2,
    available: true,
    label: "Lava-jato",
    emoji: "🚗",
    vocab: v("cliente", "clientes", "lavagem", "lavagens", "box", "boxes", "lava-jato", "m"),
    sampleServices: [s("Lavagem simples", 40, 40), s("Lavagem completa", 90, 80), s("Higienização interna", 120, 150), s("Polimento", 180, 250)],
    schemaType: "AutoWash",
    features: { ...NO_FEATURES, clientProfile: "vehicle" },
    landing: {
      title: "Agendamento online para lava-jato",
      headline: "Seus boxes ocupados na hora certa",
      subheadline: "O cliente informa modelo, placa e porte do veículo, escolhe a lavagem e o horário. Cada box tem a sua agenda.",
      pains: [
        commonPains.phone,
        { icon: "🚗", title: "Preço muda com o tamanho do carro", body: "Preço por porte: compacto, sedan/SUV e grande. O cliente vê o valor certo antes de marcar." },
        { ...commonPains.noShow, title: "Box parado por falta de aviso" },
      ],
      examples: ["Lavagem simples", "Lavagem completa", "Higienização", "Polimento", "Cristalização"],
      faq: [
        { q: "A agenda é por box?", a: "Sim. Cadastre cada box como um profissional, com os horários de funcionamento." },
        { q: "Guarda os dados do veículo?", a: "Sim: modelo, placa e porte ficam na ficha do cliente e aparecem na agenda." },
        { q: "Posso ter preço diferente por tamanho?", a: "Sim, em cada serviço você define o preço por porte." },
      ],
    },
  },
  // ---------------------------------------------------------------- Onda 3
  // Saúde: modo discreto ligado (src/lib/discreet.ts). Os textos jurídicos
  // ainda precisam de revisão de advogado antes de operar comercialmente.
  psicologo: {
    slug: "psicologo",
    wave: 3,
    available: true,
    label: "Psicólogo",
    emoji: "🧠",
    vocab: v("paciente", "pacientes", "sessão", "sessões", "profissional", "profissionais", "consultório", "m"),
    sampleServices: [s("Sessão de terapia", 50, 180), s("Primeira sessão", 50, 180), s("Sessão online", 50, 160)],
    schemaType: "MedicalBusiness",
    features: { ...NO_FEATURES, online: true, discreet: true, returnEveryDays: 7 },
    landing: {
      title: "Agendamento online para psicólogo",
      headline: "Agenda de sessões com privacidade",
      subheadline:
        "O paciente marca sozinho e recebe lembretes que não citam o tipo de atendimento. Nenhum dado clínico passa pela plataforma.",
      pains: [
        commonPains.phone,
        { ...commonPains.noShow, title: "Falta em sessão de 50 minutos" },
        { icon: "🔒", title: "O horário já é um dado sensível", body: "No modo discreto, avisos e eventos de agenda dizem só “seu horário”, sem serviço nem profissional. Não há avaliações públicas." },
      ],
      examples: ["Sessão individual", "Primeira sessão", "Sessão online"],
      faq: [
        { q: "A plataforma guarda prontuário?", a: "Não. Ela cuida só da agenda: nome, telefone e horário. Prontuário e anotações clínicas ficam no seu sistema próprio." },
        { q: "O lembrete revela que é psicoterapia?", a: "Não. No modo discreto, o aviso diz “seu horário” com dia e hora, sem citar o serviço." },
        { q: "Respeita as normas do conselho?", a: "A divulgação e o sigilo seguem as normas do seu conselho profissional. Confira com ele o que pode constar na sua página pública." },
      ],
    },
  },
  fisioterapeuta: {
    slug: "fisioterapeuta",
    wave: 3,
    available: true,
    label: "Fisioterapeuta",
    emoji: "🩺",
    vocab: v("paciente", "pacientes", "sessão", "sessões", "profissional", "profissionais", "clínica", "f"),
    sampleServices: [s("Avaliação fisioterapêutica", 60, 150), s("Sessão de fisioterapia", 50, 120), s("Pacote de 10 sessões", 50, 1000)],
    schemaType: "Physiotherapy",
    features: { ...NO_FEATURES, home: true, discreet: true, returnEveryDays: 7 },
    landing: {
      title: "Agendamento online para fisioterapeuta",
      headline: "Pacotes de sessões e agenda com privacidade",
      subheadline: "Controle quantas sessões o paciente ainda tem, agende cada uma e envie lembretes que não citam o tratamento.",
      pains: [
        { icon: "🎁", title: "Perder a conta das sessões", body: "Pacotes com saldo: cada sessão marcada desconta automaticamente." },
        commonPains.noShow,
        { icon: "🔒", title: "O horário já é um dado sensível", body: "Avisos discretos, sem serviço nem profissional, e sem avaliações públicas." },
      ],
      examples: ["Avaliação", "Sessão", "Pacote de sessões"],
      faq: [
        { q: "Controla pacote de sessões?", a: "Sim. Você define o pacote, vende ao paciente e o saldo diminui a cada sessão." },
        { q: "Guarda dados clínicos?", a: "Não. Só agenda e contato. Evolução e prontuário ficam fora da plataforma." },
      ],
    },
  },
  dentista: {
    slug: "dentista",
    wave: 3,
    available: true,
    label: "Dentista",
    emoji: "🦷",
    vocab: v("paciente", "pacientes", "consulta", "consultas", "profissional", "profissionais", "consultório", "m"),
    sampleServices: [s("Avaliação", 30, 100), s("Limpeza", 45, 150), s("Clareamento", 60, 600), s("Retorno", 30, 0)],
    schemaType: "Dentist",
    features: { ...NO_FEATURES, discreet: true, returnEveryDays: 180 },
    landing: {
      title: "Agendamento online para dentista",
      headline: "Agenda do consultório com menos faltas",
      subheadline: "O paciente marca pelo seu link, confirma presença e recebe lembretes discretos, sem citar o procedimento.",
      pains: [
        commonPains.phone,
        { ...commonPains.noShow, title: "Cadeira vazia por falta de aviso" },
        { icon: "🔒", title: "O horário já é um dado sensível", body: "Avisos discretos, sem serviço nem profissional, e sem avaliações públicas." },
      ],
      examples: ["Avaliação", "Limpeza", "Clareamento", "Retorno"],
      faq: [
        { q: "O paciente sem convênio consegue marcar?", a: "Sim. O agendamento é por serviço e horário; convênio não é tratado pela plataforma." },
        { q: "Guarda prontuário ou odontograma?", a: "Não. Só agenda e contato." },
      ],
    },
  },
  medico: {
    slug: "medico",
    wave: 3,
    available: true,
    label: "Médico",
    emoji: "⚕️",
    vocab: v("paciente", "pacientes", "consulta", "consultas", "profissional", "profissionais", "consultório", "m"),
    sampleServices: [s("Consulta", 30, 250), s("Retorno", 20, 0), s("Teleconsulta", 30, 200)],
    schemaType: "Physician",
    features: { ...NO_FEATURES, online: true, discreet: true },
    landing: {
      title: "Agendamento online para médico",
      headline: "Agenda de consultas com privacidade",
      subheadline: "Paciente marca sozinho, confirma presença e recebe lembretes discretos. Nenhum dado clínico passa pela plataforma.",
      pains: [
        commonPains.phone,
        commonPains.noShow,
        { icon: "🔒", title: "O horário já é um dado sensível", body: "Avisos discretos, sem serviço nem profissional, e sem avaliações públicas." },
      ],
      examples: ["Consulta", "Retorno", "Teleconsulta"],
      faq: [
        { q: "A plataforma guarda prontuário?", a: "Não. Ela cuida só da agenda. Prontuário fica no seu sistema, conforme as regras do conselho de medicina." },
        { q: "O que aparece no lembrete?", a: "Só “seu horário”, com dia, hora e o nome do consultório." },
      ],
    },
  },
};

export function isSegmentSlug(value: unknown): value is SegmentSlug {
  return typeof value === "string" && (SEGMENT_SLUGS as readonly string[]).includes(value);
}

/** Aceita o que vier do banco ou de um formulário; desconhecido cai no padrão. */
export function getSegment(value: string | null | undefined): SegmentConfig {
  return isSegmentSlug(value) ? SEGMENTS[value] : SEGMENTS[DEFAULT_SEGMENT];
}

/** Segmentos que o cadastro oferece (onda 3 e os que dependem de ficha extra ficam de fora). */
export function availableSegments(): SegmentConfig[] {
  return SEGMENT_SLUGS.map((slug) => SEGMENTS[slug]).filter((seg) => seg.available);
}

/** Primeira letra maiúscula — pra usar o vocabulário no início de frase ou em título. */
export function cap(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** "do salão" / "da barbearia" */
export function businessOf(vocab: SegmentVocab): string {
  return `${vocab.businessGender === "f" ? "da" : "do"} ${vocab.business}`;
}

/** Artigos e concordâncias de "atendimento/sessão/aula" (f) ou "atendimento" (m). */
export function grammar(gender: "m" | "f") {
  return gender === "f"
    ? { the: "a", a: "uma", this: "essa", your: "sua", of: "da", in: "na", none: "Nenhuma", any: "alguma" }
    : { the: "o", a: "um", this: "esse", your: "seu", of: "do", in: "no", none: "Nenhum", any: "algum" };
}
