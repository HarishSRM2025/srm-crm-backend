import { Controller, Post, Get, Body } from '@nestjs/common';
import { UserAuthService } from './user-auth.service';

@Controller('auth')
export class UserAuthController {
  constructor(private readonly userAuthService: UserAuthService) {}

  @Post('signup')
  signup(
    @Body()
    body: {
      email_id: string;
      password: string;
      role: string;
      institution_id?: number;
      department_id?: number;
    },
  ) {
    return this.userAuthService.signup(body);
  }

  @Post('signin')
  signin(@Body() body: { email_id: string; password: string }) {
    return this.userAuthService.signin(body.email_id, body.password);
  }

  @Get('users')
  findAll() {
    return this.userAuthService.findAll();
  }
}
