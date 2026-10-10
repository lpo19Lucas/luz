/**
 * Textos-base dos documentos jurídicos da DLJ Innovations. Funções (e não constantes)
 * porque interpolam os dados da empresa de getLegalEntity(), que vêm de env
 * vars lidas em runtime.
 *
 * ⚠️ BASE para revisão jurídica — ver comentário em src/lib/legal.ts.
 */
import { getLegalEntity, type LegalSection } from "@/lib/legal";

type Doc = { title: string; intro: string; sections: LegalSection[] };

function identification() {
  const e = getLegalEntity();
  return `${e.companyName}, inscrita no CNPJ sob o nº ${e.cnpj}, com sede em ${e.address} ("${e.brand}" ou "nós")`;
}

// ------------------------------------------------------------
// Termos de Uso
// ------------------------------------------------------------
export function termsOfUse(): Doc {
  const e = getLegalEntity();
  return {
    title: "Termos de Uso",
    intro: `Estes Termos de Uso regulam o acesso e o uso da plataforma ${e.brand}, oferecida por ${identification()}. Ao criar uma conta, acessar o painel ou agendar um horário por um link de salão, você declara ter lido e concordado com estes Termos e com a Política de Privacidade.`,
    sections: [
      {
        title: "O que é a plataforma",
        paragraphs: [
          `A ${e.brand} é um software como serviço (SaaS) de agendamento online para salões de beleza, barbearias e negócios similares. Oferece um link público para que clientes agendem horários, além de um painel de gestão para o estabelecimento (agenda, profissionais, serviços, clientes, pacotes, avaliações, métricas e afins).`,
          `A ${e.brand} é uma ferramenta: não presta os serviços de beleza agendados e não é parte da relação entre o estabelecimento e seus clientes.`,
        ],
      },
      {
        title: "Quem pode usar",
        paragraphs: [
          "Usuário Assinante é a pessoa (física ou jurídica) que cria uma conta para gerir o seu estabelecimento. Deve ser maior de 18 anos e capaz civilmente, e declara que as informações fornecidas no cadastro são verdadeiras.",
          "Cliente Final é a pessoa que agenda um horário por meio do link público de um estabelecimento, sem precisar de conta.",
          "Profissional com acesso é a pessoa da equipe do estabelecimento que o Usuário Assinante convida para ver a própria agenda e receber os próprios agendamentos. O Usuário Assinante é responsável por conceder e retirar esses acessos.",
        ],
      },
      {
        title: "Conta e segurança",
        paragraphs: [
          "O Usuário Assinante é responsável por manter a confidencialidade da sua senha e por toda atividade realizada na sua conta. Em caso de suspeita de uso indevido, deve alterar a senha imediatamente e nos avisar.",
          "Podemos limitar tentativas de acesso, exigir redefinição de senha ou suspender temporariamente uma conta para proteger a segurança da plataforma.",
        ],
      },
      {
        title: "Período de teste, planos e pagamento",
        paragraphs: [
          "Novas contas contam com um período de teste gratuito, com duração informada no momento do cadastro. Após o término, o uso continuado depende da contratação de um plano pago, nas condições e valores divulgados na plataforma.",
          "O pagamento é feito via PIX para a chave indicada na tela de assinatura e a liberação é confirmada manualmente. Após o vencimento há uma carência de alguns dias; depois dela, o link público de agendamento é suspenso até a regularização, sem perda dos dados.",
          "Os valores podem ser reajustados, com aviso prévio de pelo menos 30 dias para os planos em vigor. As condições comerciais completas estão no Contrato de Licença de Uso.",
        ],
      },
      {
        title: "Uso permitido e proibido",
        paragraphs: [
          "É proibido: usar a plataforma para fins ilícitos ou fraudulentos; cadastrar dados de terceiros sem base legal; tentar acessar contas ou dados de outros estabelecimentos; fazer engenharia reversa, sobrecarregar ou atacar a infraestrutura; publicar conteúdo ofensivo, discriminatório ou que viole direitos de terceiros (inclusive imagens sem autorização).",
          "Fotos de profissionais, serviços e do estabelecimento enviadas pelo Usuário Assinante são de sua responsabilidade, inclusive quanto à autorização de uso de imagem das pessoas retratadas.",
        ],
      },
      {
        title: "Responsabilidades do estabelecimento",
        paragraphs: [
          "O estabelecimento é o único responsável pelos serviços que presta, pelos preços, horários e políticas de cancelamento que divulga, pelo atendimento aos seus clientes e pelo cumprimento das leis aplicáveis ao seu negócio, incluindo as de defesa do consumidor.",
          "Em relação aos dados pessoais dos seus clientes, o estabelecimento atua como Controlador nos termos da LGPD, e a plataforma como Operadora (ver Política de Privacidade e Contrato de Licença).",
        ],
      },
      {
        title: "Disponibilidade e limitação de responsabilidade",
        paragraphs: [
          "Empregamos esforços razoáveis para manter a plataforma disponível e segura, mas ela pode passar por interrupções para manutenção, por falhas de terceiros (hospedagem, internet, provedores de e-mail) ou por casos fortuitos e de força maior.",
          `Na máxima extensão permitida pela lei, a ${e.brand} não responde por lucros cessantes, perda de clientes ou danos indiretos decorrentes do uso ou da indisponibilidade da plataforma. A responsabilidade total da ${e.brand} fica limitada ao valor pago pelo Usuário Assinante nos 12 meses anteriores ao evento.`,
        ],
      },
      {
        title: "Propriedade intelectual",
        paragraphs: [
          `O software, a marca ${e.brand}, o layout e os demais elementos da plataforma pertencem a ${e.companyName}. O uso concede apenas uma licença limitada, não exclusiva e intransferível, durante a vigência da assinatura.`,
          "Os dados inseridos pelo estabelecimento (cadastros, agenda, fotos) continuam sendo dele.",
        ],
      },
      {
        title: "Cancelamento e encerramento",
        paragraphs: [
          "O Usuário Assinante pode cancelar a qualquer momento, sem multa, deixando de renovar o plano ou solicitando o encerramento pelo suporte. Não há reembolso proporcional de período já pago, salvo disposição legal em contrário.",
          "Podemos suspender ou encerrar contas que violem estes Termos, mediante aviso quando possível.",
          "Após o encerramento, os dados poderão ser exportados mediante solicitação em até 30 dias; depois disso, serão excluídos ou anonimizados, ressalvadas as hipóteses legais de guarda.",
        ],
      },
      {
        title: "Alterações destes Termos",
        paragraphs: [
          "Podemos atualizar estes Termos. Mudanças relevantes serão comunicadas pela plataforma ou por e-mail, e poderemos solicitar um novo aceite. A versão vigente é sempre a publicada nesta página.",
        ],
      },
      {
        title: "Lei aplicável e foro",
        paragraphs: [
          `Estes Termos são regidos pelas leis da República Federativa do Brasil. Fica eleito o foro da comarca de ${e.forumCity} para dirimir controvérsias, ressalvado o direito do consumidor de ajuizar ação no foro do seu domicílio.`,
          `Contato: ${e.contactEmail}.`,
        ],
      },
    ],
  };
}

// ------------------------------------------------------------
// Política de Privacidade (LGPD — Lei nº 13.709/2018)
// ------------------------------------------------------------
export function privacyPolicy(): Doc {
  const e = getLegalEntity();
  return {
    title: "Política de Privacidade",
    intro: `Esta Política explica como a ${e.brand}, oferecida por ${identification()}, trata dados pessoais, em conformidade com a Lei Geral de Proteção de Dados Pessoais (Lei nº 13.709/2018 — LGPD).`,
    sections: [
      {
        title: "Papéis no tratamento de dados",
        paragraphs: [
          `Dados dos Usuários Assinantes (donos e equipe dos estabelecimentos): a ${e.brand} é a Controladora.`,
          `Dados dos Clientes Finais (quem agenda horário num estabelecimento): o estabelecimento é o Controlador, e a ${e.brand} é Operadora, tratando esses dados apenas para prestar o serviço de agendamento, conforme as instruções do estabelecimento. Pedidos sobre esses dados devem ser feitos preferencialmente ao próprio estabelecimento; se chegarem até nós, encaminharemos a ele.`,
        ],
      },
      {
        title: "Quais dados coletamos",
        paragraphs: [
          "Usuário Assinante: nome, e-mail, telefone, senha (armazenada apenas de forma criptografada, com hash), dados do estabelecimento (nome, endereço, CNPJ, redes sociais, fotos), registro de aceite destes documentos e dados de uso e acesso (data e hora de login, endereço IP para segurança).",
          "Cliente Final: nome, telefone, histórico de agendamentos (serviço, profissional, data, comparecimento), avaliações que optar por deixar e anotações que o estabelecimento registrar.",
          "Notificações (quem ativar): o endereço técnico de entrega fornecido pelo navegador ou celular (inscrição de push, com chaves de criptografia), o tipo de navegador e o registro de cada notificação enviada (tipo, data e se foi entregue). Profissionais com acesso: nome, e-mail, telefone e senha (com hash).",
          "Não coletamos dados pessoais sensíveis (art. 5º, II, da LGPD) de forma intencional. O estabelecimento não deve registrar esse tipo de dado nas anotações de clientes.",
        ],
      },
      {
        title: "Para que usamos e com qual base legal",
        paragraphs: [
          "Execução de contrato (art. 7º, V): criar e manter a conta, operar a agenda, permitir o agendamento online, enviar confirmações, lembretes e links de gerenciamento do agendamento.",
          "Consentimento (art. 7º, I) para notificações no aparelho: só são enviadas depois que a pessoa toca em \"Ativar notificações\" e autoriza no navegador; podem ser desativadas a qualquer momento pelo próprio botão ou nas configurações do aparelho.",
          "Legítimo interesse (art. 7º, IX): segurança da plataforma (prevenção de fraude e de acesso indevido, limite de tentativas de login), suporte e melhoria do produto com dados agregados.",
          "Cumprimento de obrigação legal (art. 7º, II): guarda de registros de acesso (Marco Civil da Internet, art. 15) e documentos fiscais.",
          "Consentimento (art. 7º, I): comunicações de marketing, quando houver, sempre com opção de descadastro.",
        ],
      },
      {
        title: "Com quem compartilhamos",
        paragraphs: [
          "Não vendemos dados pessoais. Compartilhamos apenas com fornecedores necessários para operar o serviço — hospedagem e banco de dados em nuvem, envio de e-mails transacionais, os serviços de notificação dos próprios navegadores e sistemas (como Google, Apple e Mozilla, que recebem o conteúdo da notificação criptografado) e, quando ativadas, ferramentas de inteligência artificial para gerar textos do perfil do estabelecimento (sem envio de dados de clientes) —, todos sujeitos a obrigações de confidencialidade e segurança.",
          "Alguns desses fornecedores podem armazenar dados fora do Brasil; nesses casos, adotamos as salvaguardas previstas no art. 33 da LGPD.",
          "Também podemos compartilhar dados por ordem judicial ou requisição de autoridade competente.",
        ],
      },
      {
        title: "Por quanto tempo guardamos",
        paragraphs: [
          "Enquanto a conta estiver ativa. Após o encerramento, os dados são mantidos por até 30 dias para eventual exportação e depois excluídos ou anonimizados, exceto registros que a lei obrigue a guardar (como registros de acesso, por 6 meses, e documentos fiscais, pelo prazo legal).",
          "Links de redefinição de senha expiram em poucas horas e são de uso único; convites, em 7 dias.",
          "Inscrições de notificação são apagadas quando a pessoa desativa, quando o aparelho deixa de aceitá-las ou quando o acesso do profissional é retirado.",
        ],
      },
      {
        title: "Seus direitos",
        paragraphs: [
          "Nos termos do art. 18 da LGPD, você pode solicitar: confirmação da existência de tratamento; acesso aos dados; correção de dados incompletos ou desatualizados; anonimização, bloqueio ou eliminação de dados desnecessários; portabilidade; eliminação dos dados tratados com consentimento; informação sobre compartilhamentos; e revogação do consentimento.",
          `Os pedidos podem ser feitos pelo e-mail do Encarregado (${e.dpoEmail}). Responderemos em até 15 dias. Você também pode apresentar reclamação à Autoridade Nacional de Proteção de Dados (ANPD).`,
        ],
      },
      {
        title: "Segurança",
        paragraphs: [
          "Adotamos medidas técnicas e administrativas para proteger os dados: conexão criptografada (HTTPS), senhas com hash, isolamento dos dados de cada estabelecimento, controle de acesso ao painel administrativo, limite de tentativas de login e links de acesso com expiração.",
          "Em caso de incidente de segurança que possa gerar risco ou dano relevante, comunicaremos os afetados e a ANPD, nos termos do art. 48 da LGPD.",
        ],
      },
      {
        title: "Cookies",
        paragraphs: [
          "Usamos apenas cookies essenciais: o de sessão, que mantém o usuário logado no painel. Não usamos cookies de publicidade. O navegador do Cliente Final pode guardar localmente os dados do último agendamento para facilitar o próximo, e o próprio cliente pode apagá-los a qualquer momento.",
          "Para funcionar como aplicativo (instalável e com notificações), o site registra um service worker no navegador, que guarda apenas uma página de \"sem conexão\" — nenhum dado pessoal.",
        ],
      },
      {
        title: "Encarregado (DPO) e contato",
        paragraphs: [
          `Encarregado pelo tratamento de dados pessoais: ${e.dpoName} — ${e.dpoEmail}.`,
          `Controladora: ${identification()}.`,
        ],
      },
      {
        title: "Alterações desta Política",
        paragraphs: [
          "Esta Política pode ser atualizada. A versão vigente e a data da última atualização ficam sempre nesta página, e mudanças relevantes serão comunicadas.",
        ],
      },
    ],
  };
}

// ------------------------------------------------------------
// Contrato de Licença de Uso de Software (SaaS) + tratamento de dados
// ------------------------------------------------------------
export function licenseAgreement(): Doc {
  const e = getLegalEntity();
  return {
    title: "Contrato de Licença de Uso de Software (SaaS)",
    intro: `Pelo presente instrumento, de um lado ${identification()}, doravante LICENCIANTE, e de outro a pessoa física ou jurídica que realiza o cadastro na plataforma, doravante LICENCIADA, celebram este Contrato, aceito eletronicamente no momento do cadastro, que se rege pelas cláusulas abaixo, pelos Termos de Uso e pela Política de Privacidade, que dele fazem parte.`,
    sections: [
      {
        title: "Objeto",
        paragraphs: [
          `Licença de uso, não exclusiva, intransferível e por prazo determinado (enquanto vigente a assinatura), da plataforma ${e.brand}, acessada pela internet, para gestão de agenda e agendamento online do estabelecimento da LICENCIADA.`,
          "Não estão incluídos: serviços de consultoria, customizações específicas, integração com sistemas de terceiros não disponibilizada na plataforma, nem equipamentos ou acesso à internet.",
        ],
      },
      {
        title: "Vigência e período de teste",
        paragraphs: [
          "O Contrato entra em vigor na data do aceite eletrônico. A LICENCIADA tem direito a um período de teste gratuito, com duração informada no cadastro, sem obrigação de contratação posterior.",
          "Após o teste, o Contrato vigora pelo período do plano escolhido (mensal, trimestral, anual ou outro oferecido), renovando-se a cada pagamento.",
        ],
      },
      {
        title: "Preço, pagamento e reajuste",
        paragraphs: [
          "O valor é o do plano escolhido, conforme a tabela vigente divulgada na plataforma no momento da contratação ou da renovação.",
          "O pagamento é feito antecipadamente via PIX para a chave oficial da LICENCIANTE informada na tela de assinatura. A liberação é confirmada após a conferência do pagamento.",
          "Na falta de pagamento, a LICENCIADA terá carência de 5 (cinco) dias após o vencimento; depois disso, o link público de agendamento será suspenso até a regularização. Os dados não são apagados pela suspensão.",
          "Os valores poderão ser reajustados mediante aviso prévio mínimo de 30 dias, valendo o novo valor a partir da renovação seguinte.",
        ],
      },
      {
        title: "Obrigações da LICENCIANTE",
        paragraphs: [
          "Manter a plataforma em funcionamento com esforços razoáveis de disponibilidade, realizando manutenções preferencialmente em horários de menor uso.",
          "Oferecer suporte por canal digital (WhatsApp ou e-mail), em dias úteis e horário comercial.",
          "Manter cópias de segurança (backup) do banco de dados e adotar medidas de segurança compatíveis com o padrão de mercado.",
          "Tratar os dados pessoais conforme a cláusula de Proteção de Dados abaixo.",
        ],
      },
      {
        title: "Obrigações da LICENCIADA",
        paragraphs: [
          "Fornecer informações verdadeiras no cadastro e mantê-las atualizadas, inclusive dados fiscais quando solicitados.",
          "Pagar pontualmente o plano contratado.",
          "Usar a plataforma conforme os Termos de Uso e a legislação, sendo a única responsável pelos serviços prestados aos seus clientes, preços e políticas divulgadas.",
          "Manter a confidencialidade das credenciais de acesso e gerenciar os acessos que conceder a profissionais da equipe, retirando-os quando a pessoa deixar o estabelecimento.",
          "Ter base legal para os dados pessoais de clientes que inserir na plataforma, informar seus clientes sobre o tratamento e atender aos pedidos de titulares (como Controladora).",
        ],
      },
      {
        title: "Proteção de dados pessoais (LGPD)",
        paragraphs: [
          "Quanto aos dados pessoais dos clientes finais, a LICENCIADA é Controladora e a LICENCIANTE é Operadora (art. 5º, VI e VII, da LGPD). A LICENCIANTE tratará esses dados somente para executar este Contrato e conforme as instruções lícitas da LICENCIADA, sendo vedado usá-los para finalidade própria.",
          "A LICENCIANTE se compromete a: (a) manter medidas de segurança técnicas e administrativas aptas a proteger os dados; (b) garantir a confidencialidade por parte de quem os acessa; (c) usar suboperadores (hospedagem, banco de dados, e-mail) apenas com obrigações equivalentes de proteção; (d) auxiliar a LICENCIADA no atendimento a pedidos de titulares e à ANPD; (e) comunicar à LICENCIADA, em prazo razoável, qualquer incidente de segurança envolvendo esses dados; (f) ao fim do Contrato, disponibilizar os dados para exportação por 30 dias e depois eliminá-los, salvo obrigação legal de guarda.",
          "Quanto aos dados da própria LICENCIADA e de seus usuários, a LICENCIANTE atua como Controladora, conforme a Política de Privacidade.",
        ],
      },
      {
        title: "Propriedade intelectual",
        paragraphs: [
          "O software, código-fonte, marca, layout e documentação são de propriedade exclusiva da LICENCIANTE. Este Contrato não transfere qualquer direito de propriedade, apenas a licença de uso.",
          "Os dados inseridos pela LICENCIADA permanecem de sua titularidade.",
        ],
      },
      {
        title: "Limitação de responsabilidade",
        paragraphs: [
          "A LICENCIANTE não se responsabiliza por: falhas de internet, energia ou equipamentos da LICENCIADA ou de seus clientes; indisponibilidade de serviços de terceiros; uso indevido da plataforma pela LICENCIADA; ou pela relação entre a LICENCIADA e seus clientes (atendimento, faltas, cobranças).",
          "Em qualquer hipótese, a responsabilidade total da LICENCIANTE fica limitada ao valor efetivamente pago pela LICENCIADA nos 12 (doze) meses anteriores ao evento, excluídos lucros cessantes e danos indiretos, na máxima extensão permitida em lei.",
        ],
      },
      {
        title: "Rescisão",
        paragraphs: [
          "A LICENCIADA pode rescindir a qualquer momento, sem multa, deixando de renovar ou solicitando pelo suporte. Não há devolução de valores do período já iniciado, salvo previsão legal.",
          "A LICENCIANTE pode rescindir em caso de violação deste Contrato ou dos Termos de Uso, inadimplência superior a 60 dias, ou mediante aviso prévio de 30 dias em caso de descontinuidade do serviço, hipótese em que devolverá proporcionalmente valores pagos e não usufruídos.",
        ],
      },
      {
        title: "Disposições gerais",
        paragraphs: [
          "Este Contrato é aceito eletronicamente, com registro de data, hora e versão do documento aceito, o que as partes reconhecem como válido e suficiente (art. 10, § 2º, da MP 2.200-2/2001).",
          "A tolerância de uma parte quanto ao descumprimento de qualquer cláusula não implica renúncia ou novação.",
          "Se alguma cláusula for considerada inválida, as demais permanecem válidas.",
          `Fica eleito o foro da comarca de ${e.forumCity} para dirimir quaisquer dúvidas oriundas deste Contrato, com renúncia a qualquer outro, por mais privilegiado que seja.`,
        ],
      },
    ],
  };
}
