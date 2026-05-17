# Telegram Bot Architecture

## Overview

The Telegram bot is built with Telegraf and runs inside the API process (not as a separate server). It provides a mobile-friendly interface for users to interact with the association management system, receive notifications, and manage their account settings.

## Architecture

### Process Integration

```
┌─────────────────────────────────────────────────┐
│              API Process (NestJS)                │
├─────────────────────────────────────────────────┤
│  ┌──────────────┐    ┌──────────────────────┐   │
│  │  HTTP Server │    │   Telegram Bot       │   │
│  │  (Fastify)   │    │   (Telegraf)         │   │
│  │  Port: 3000  │    │   Webhook Handler    │   │
│  └──────────────┘    └──────────────────────┘   │
│                                                  │
│  Shared: PrismaService, AuthService, etc.       │
└─────────────────────────────────────────────────┘
```

**Key Points**:
- Bot runs inside the API process
- Webhook endpoint: `/telegram/webhook` (outside `api/v1` prefix)
- Shares PrismaService and other providers with API
- Uses same JWT system for authentication

### Bot Structure

```
apps/bot/
├── src/
│   ├── index.ts                # Module export
│   ├── bot.module.ts           # NestJS module
│   ├── bot.service.ts          # Main bot service
│   ├── main.ts                 # Bot initialization
│   ├── commands/               # Bot commands
│   │   ├── start.command.ts    # /start command
│   │   ├── link.command.ts     # /link command
│   │   ├── settings.command.ts # /settings command
│   │   └── tasks.command.ts    # /tasks command
│   ├── handlers/               # Event handlers
│   │   ├── callback.handler.ts # Callback query handler
│   │   └── message.handler.ts  # Message handler
│   ├── keyboards/              # Inline keyboards
│   │   ├── main.keyboard.ts    # Main menu keyboard
│   │   └── task.keyboard.ts    # Task action keyboard
│   └── wizards/                # Multi-step conversations
│       ├── link.wizard.ts      # Link account wizard
│       └── settings.wizard.ts  # Settings wizard
└── package.json
```

## Bot Module

### Module Definition

```typescript
// bot.module.ts
@Module({
  imports: [PrismaModule, AuthModule],
  providers: [BotService],
  exports: [BotService],
})
export class BotModule {}
```

### Bot Service

```typescript
// bot.service.ts
@Injectable()
export class BotService {
  private bot: Telegraf<Context>;
  
  constructor(
    private prisma: PrismaService,
    private authService: AuthService,
  ) {
    this.bot = new Telegraf(process.env.BOT_TOKEN);
    this.setupCommands();
    this.setupHandlers();
  }
  
  getBot(): Telegraf<Context> {
    return this.bot;
  }
  
  private setupCommands() {
    this.bot.command('start', this.handleStart);
    this.bot.command('link', this.handleLink);
    this.bot.command('settings', this.handleSettings);
    this.bot.command('tasks', this.handleTasks);
  }
  
  private setupHandlers() {
    this.bot.on('callback_query', this.handleCallback);
    this.bot.on('message', this.handleMessage);
  }
  
  async handleUpdate(update: Update) {
    await this.bot.handleUpdate(update);
  }
  
  async sendNotification(userId: string, message: string) {
    const telegramAccount = await this.prisma.telegramAccount.findUnique({
      where: { userId }
    });
    
    if (telegramAccount) {
      await this.bot.telegram.sendMessage(
        telegramAccount.telegramId.toString(),
        message
      );
    }
  }
}
```

## Commands

### /start

**Purpose**: Welcome message and initial setup.

**Flow**:
```
User: /start
Bot:  Welcome! To get started, please link your account using /link
      [Link Account] [Help]
```

**Implementation**:
```typescript
async handleStart(ctx: Context) {
  const telegramId = BigInt(ctx.from.id);
  const account = await this.prisma.telegramAccount.findUnique({
    where: { telegramId }
  });
  
  if (account) {
    await ctx.reply('Welcome back!', {
      reply_markup: {
        inline_keyboard: this.getMainMenuKeyboard()
      }
    });
  } else {
    await ctx.reply('Welcome! Please link your account to get started.', {
      reply_markup: {
        inline_keyboard: [[{ text: 'Link Account', callback_data: 'link' }]]
      }
    });
  }
}
```

### /link

**Purpose**: Link Telegram account to system user.

**Flow**:
```
User: /link
Bot:  Please enter your link token:
      [Cancel]

User: <token>
Bot:  Processing...
      ✓ Account linked successfully!
      You can now use all bot features.
```

**Implementation**:
```typescript
async handleLink(ctx: Context) {
  await ctx.reply('Please enter your link token:', {
    reply_markup: {
      inline_keyboard: [[{ text: 'Cancel', callback_data: 'cancel' }]]
    }
  });
  
  // Wait for next message (handled by message handler)
}

async handleLinkToken(ctx: Context, token: string) {
  try {
    const result = await this.authService.redeemLinkToken(
      token,
      BigInt(ctx.from.id),
      ctx.from.username
    );
    
    await ctx.reply('✓ Account linked successfully!');
    
    // Store bot token for future requests
    // (implementation depends on storage strategy)
    
  } catch (error) {
    await ctx.reply('✗ Invalid or expired token.');
  }
}
```

### /settings

**Purpose**: User settings management.

**Flow**:
```
User: /settings
Bot:  Settings:
      [Profile] [Notifications] [Telegram] [Logout]
```

**Implementation**:
```typescript
async handleSettings(ctx: Context) {
  const telegramId = BigInt(ctx.from.id);
  const account = await this.prisma.telegramAccount.findUnique({
    where: { telegramId },
    include: { user: true }
  });
  
  if (!account) {
    return ctx.reply('Please link your account first using /link');
  }
  
  await ctx.reply('Settings:', {
    reply_markup: {
      inline_keyboard: [
        [{ text: 'Profile', callback_data: 'settings:profile' }],
        [{ text: 'Notifications', callback_data: 'settings:notifications' }],
        [{ text: 'Telegram', callback_data: 'settings:telegram' }],
        [{ text: 'Logout', callback_data: 'settings:logout' }],
      ]
    }
  });
}
```

### /tasks

**Purpose**: View and manage assigned tasks.

**Flow**:
```
User: /tasks
Bot:  Your Tasks:
      
      1. [PENDING] Prepare monthly report
         Due: 2026-05-20
         [View] [Mark Complete]
      
      2. [IN_PROGRESS] Update member database
         Due: 2026-05-25
         [View] [Mark Complete]
```

**Implementation**:
```typescript
async handleTasks(ctx: Context) {
  const telegramId = BigInt(ctx.from.id);
  const account = await this.prisma.telegramAccount.findUnique({
    where: { telegramId },
    include: { user: true }
  });
  
  if (!account) {
    return ctx.reply('Please link your account first using /link');
  }
  
  const tasks = await this.prisma.task.findMany({
    where: {
      assignedToUserId: account.userId,
      status: { in: ['PENDING', 'IN_PROGRESS'] },
      deletedAt: null
    },
    orderBy: { dueDate: 'asc' }
  });
  
  if (tasks.length === 0) {
    return ctx.reply('No active tasks.');
  }
  
  const message = tasks.map((task, i) => {
    const dueDate = task.dueDate 
      ? `Due: ${format(task.dueDate, 'yyyy-MM-dd')}`
      : 'No due date';
    
    return `${i + 1}. [${task.status}] ${task.title}\n${dueDate}`;
  }).join('\n\n');
  
  await ctx.reply(`Your Tasks:\n\n${message}`);
}
```

## Handlers

### Callback Handler

Processes inline keyboard button clicks.

```typescript
async handleCallback(ctx: Context) {
  const callbackData = ctx.callbackQuery.data;
  const [action, ...params] = callbackData.split(':');
  
  switch (action) {
    case 'link':
      return this.handleLinkAction(ctx);
    
    case 'task':
      return this.handleTaskAction(ctx, params);
    
    case 'settings':
      return this.handleSettingsAction(ctx, params);
    
    case 'cancel':
      return ctx.editMessageText('Cancelled.');
    
    default:
      return ctx.answerCbQuery('Unknown action');
  }
}

async handleTaskAction(ctx: Context, params: string[]) {
  const [action, taskId] = params;
  
  switch (action) {
    case 'view':
      return this.showTaskDetails(ctx, taskId);
    
    case 'complete':
      return this.completeTask(ctx, taskId);
    
    case 'dispute':
      return this.disputeTask(ctx, taskId);
  }
}

async completeTask(ctx: Context, taskId: string) {
  try {
    await this.prisma.task.update({
      where: { id: taskId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date()
      }
    });
    
    // Log activity
    await this.prisma.taskActivity.create({
      data: {
        taskId,
        actorId: /* get user ID */,
        action: 'STATUS_CHANGED',
        payload: { from: 'IN_PROGRESS', to: 'COMPLETED' }
      }
    });
    
    await ctx.editMessageText('✓ Task marked as complete.');
    
  } catch (error) {
    await ctx.editMessageText('✗ Failed to update task.');
  }
}
```

### Message Handler

Processes text messages.

```typescript
async handleMessage(ctx: Context) {
  const text = ctx.message.text;
  
  // Check if user is in a wizard flow
  const session = ctx.session;
  
  if (session?.awaitingLinkToken) {
    return this.handleLinkToken(ctx, text);
  }
  
  // Default: show main menu
  await ctx.reply('Use the menu below to navigate:', {
    reply_markup: {
      inline_keyboard: this.getMainMenuKeyboard()
    }
  });
}
```

## Keyboards

### Main Menu Keyboard

```typescript
getMainMenuKeyboard() {
  return {
    inline_keyboard: [
      [{ text: '📋 My Tasks', callback_data: 'tasks' }],
      [{ text: '📅 Upcoming Events', callback_data: 'events' }],
      [{ text: '⚙️ Settings', callback_data: 'settings' }],
      [{ text: '❓ Help', callback_data: 'help' }],
    ]
  };
}
```

### Task Action Keyboard

```typescript
getTaskKeyboard(taskId: string, status: string) {
  const buttons = [];
  
  if (status === 'PENDING' || status === 'IN_PROGRESS') {
    buttons.push([
      { text: '✓ Complete', callback_data: `task:complete:${taskId}` },
      { text: '⚠️ Dispute', callback_data: `task:dispute:${taskId}` }
    ]);
  }
  
  buttons.push([{ text: '« Back', callback_data: 'tasks' }]);
  
  return { inline_keyboard: buttons };
}
```

## Wizards

Multi-step conversations for complex flows.

### Link Wizard

```typescript
// link.wizard.ts
export class LinkWizard {
  private stages: Stage;
  
  constructor() {
    this.stages = new Stage([
      new WizardScene('link-wizard',
        async (ctx) => {
          await ctx.reply('Please enter your link token:');
          return ctx.wizard.next();
        },
        async (ctx) => {
          const token = ctx.message.text;
          
          try {
            const result = await this.authService.redeemLinkToken(
              token,
              BigInt(ctx.from.id),
              ctx.from.username
            );
            
            await ctx.reply('✓ Account linked successfully!');
            return ctx.scene.leave();
            
          } catch (error) {
            await ctx.reply('✗ Invalid or expired token. Try again:');
            return ctx.wizard.back();
          }
        }
      )
    ]);
  }
  
  getStages(): Stage {
    return this.stages;
  }
}
```

## Notification System

### Task Notifications

Sent when a task is assigned:

```typescript
async notifyTaskAssignment(userId: string, task: Task) {
  const telegramAccount = await this.prisma.telegramAccount.findUnique({
    where: { userId }
  });
  
  if (!telegramAccount) {
    return; // Cannot notify without Telegram account
  }
  
  const message = `
📋 New Task Assigned

Title: ${task.title}
Due: ${task.dueDate ? format(task.dueDate, 'dd MMM yyyy') : 'No due date'}
Priority: ${task.priority}

View your tasks: /tasks
  `.trim();
  
  await this.bot.telegram.sendMessage(
    telegramAccount.telegramId.toString(),
    message,
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: 'View Task', callback_data: `task:view:${task.id}` }],
          [{ text: 'Mark Complete', callback_data: `task:complete:${task.id}` }],
        ]
      }
    }
  );
  
  // Update notification flag
  await this.prisma.task.update({
    where: { id: task.id },
    data: { notifiedViaTelegram: true, lastNotifiedAt: new Date() }
  });
}
```

### Event Reminders

Sent before an event starts:

```typescript
async notifyEventAssignment(userId: string, event: Event, assignment: EventAssignment) {
  const telegramAccount = await this.prisma.telegramAccount.findUnique({
    where: { userId }
  });
  
  if (!telegramAccount) return;
  
  const role = assignment.roleDefinition?.name || assignment.customRole;
  
  const message = `
📅 Event Reminder

Event: ${event.title}
Date: ${format(event.startsAt, 'dd MMM yyyy HH:mm')}
Your Role: ${role}
Location: ${event.location || 'TBD'}
  `.trim();
  
  await this.bot.telegram.sendMessage(
    telegramAccount.telegramId.toString(),
    message
  );
  
  await this.prisma.eventAssignment.update({
    where: { id: assignment.id },
    data: { notificationSent: true, notifiedAt: new Date() }
  });
}
```

## Authentication

### Bot JWT

After linking, users receive a bot JWT for API requests:

```typescript
// In AuthService
issueBotToken(userId: string): string {
  return this.jwtService.sign(
    { userId },
    {
      expiresIn: '30d',
      secret: process.env.JWT_SECRET
    }
  );
}
```

### Token Storage

Bot JWT can be stored:
1. In bot session (temporary)
2. Sent to user on request (for API access)
3. Used internally for API calls on behalf of user

## Webhook Setup

### Webhook Handler

Mounted in `main.ts`:

```typescript
// main.ts
const bot = app.get(BotService).getBot();

app.use(
  bot.webhookCallback(`/telegram/webhook`)
);
```

### Webhook Configuration

Set webhook URL via BotFather or API:

```typescript
await bot.telegram.setWebhook(`${process.env.API_URL}/telegram/webhook`);
```

## Bot Commands Reference

| Command | Description | Access |
|---------|-------------|--------|
| `/start` | Welcome message | All |
| `/link` | Link account with token | Unlinked users |
| `/tasks` | View assigned tasks | Linked users |
| `/settings` | User settings | Linked users |
| `/help` | Help message | All |

## Callback Actions

| Action | Description |
|--------|-------------|
| `link` | Start link flow |
| `tasks` | View tasks |
| `task:view:<id>` | View task details |
| `task:complete:<id>` | Mark task complete |
| `task:dispute:<id>` | Dispute task |
| `settings` | Open settings |
| `settings:profile` | Profile settings |
| `settings:notifications` | Notification settings |
| `settings:telegram` | Telegram settings |
| `settings:logout` | Unlink account |
| `events` | View upcoming events |
| `help` | Show help |

## Error Handling

### Graceful Degradation

```typescript
async safeSendMessage(telegramId: string, message: string) {
  try {
    await this.bot.telegram.sendMessage(telegramId, message);
  } catch (error) {
    // Log error but don't crash
    console.error(`Failed to send message to ${telegramId}:`, error);
  }
}
```

### User-Friendly Errors

```typescript
async handleTaskAction(ctx: Context, taskId: string) {
  try {
    // ... action logic
  } catch (error) {
    if (error.code === 'P2025') {
      return ctx.editMessageText('Task not found.');
    }
    
    return ctx.editMessageText('An error occurred. Please try again.');
  }
}
```

## Testing

### Manual Testing

1. Use BotFather to create test bot
2. Set `BOT_TOKEN` in `.env`
3. Start API: `pnpm dev:api`
4. Interact with bot via Telegram

### Future Automation

- Telegraf testing utilities
- Mock Telegram API
- Integration tests for command handlers

## Development Tips

### Debugging

Enable Telegraf debug mode:

```typescript
this.bot = new Telegraf(process.env.BOT_TOKEN, {
  telegram: { testEnv: false }
});

// Log all updates
this.bot.on('message', (ctx) => {
  console.log('Received message:', ctx.message);
});
```

### Local Webhook Testing

Use ngrok for local development:

```bash
ngrok http 3000
```

Set webhook URL to ngrok URL.

## Future Enhancements

### Planned Features

1. **Task reminder scheduler** - BullMQ jobs for recurring reminders
2. **Meeting notifications** - Notify attendees before meetings
3. **Event check-in** - QR code or button-based check-in
4. **Member directory** - Browse association members
5. **Quick actions** - Inline mode for quick task creation
6. **Group support** - Bot in association groups
7. **Media handling** - Receipt photos for finance module

### Notification System Integration

When BullMQ is implemented:

```typescript
// Queue notification job
await this.jobsService.queueNotification({
  type: 'task_reminder',
  userId: task.assignedToUserId,
  taskId: task.id,
  scheduledAt: task.reminderAt
});

// Process job
@Process('task_reminder')
async handleReminder(job: Job) {
  const { userId, taskId } = job.data;
  const task = await this.prisma.task.findUnique({ where: { id: taskId } });
  
  await this.botService.notifyTaskReminder(userId, task);
}
```
