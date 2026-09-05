export async function findAuthUserByEmail(auth, email) {
  let page = 1;
  while (true) {
    const { data, error } = await auth.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const user = data.users.find(
      (candidate) => candidate.email?.toLowerCase() === email.toLowerCase(),
    );
    if (user) return user;
    if (data.users.length < 200) return null;
    page += 1;
  }
}

export async function ensureLocalAdmin(auth, prisma, email, password) {
  const existing = await findAuthUserByEmail(auth, email);
  let authUser = existing;
  if (!authUser) {
    const { data, error } = await auth.createUser({ email, password, email_confirm: true });
    if (error) throw error;
    authUser = data.user;
  }
  if (!authUser) throw new Error('Local Supabase user could not be created');

  return prisma.user.upsert({
    where: { email },
    update: {
      supabaseUserId: authUser.id,
      fullName: 'Sistem Yöneticisi',
      isActive: true,
      isSystemAdmin: true,
    },
    create: {
      email,
      supabaseUserId: authUser.id,
      fullName: 'Sistem Yöneticisi',
      isActive: true,
      isSystemAdmin: true,
    },
  });
}
