import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';

const VALID_ROLES = ['HOI', 'HOD', 'Manager', 'SuperAdmin', 'Admin', 'User'];
const SALT_ROUNDS = 10;

@Injectable()
export class UserAuthService {
  constructor(private readonly prisma: PrismaService) {}

  async signup(data: {
    user_name: string;
    email_id: string;
    password: string;
    role: string;
    institution_id?: number;
    department_id?: number;
  }) {
    // Validate required fields
    if (!data.user_name || !data.user_name.trim()) {
      throw new BadRequestException('User name is required.');
    }
    if (!data.email_id || !data.email_id.trim()) {
      throw new BadRequestException('Email address is required.');
    }
    if (!data.password || data.password.length < 6) {
      throw new BadRequestException(
        'Password must be at least 6 characters long.',
      );
    }

    // Validate role
    if (!VALID_ROLES.includes(data.role)) {
      throw new BadRequestException(
        `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}`,
      );
    }

    // Role-based field validation
    if (data.role === 'HOI') {
      if (!data.institution_id) {
        throw new BadRequestException('HOI must select an institution.');
      }
      data.department_id = undefined;
    } else if (data.role === 'HOD') {
      if (!data.institution_id || !data.department_id) {
        throw new BadRequestException(
          'HOD must select both institution and department.',
        );
      }
    } else {
      // Manager, SuperAdmin, Admin — no institution/department
      data.institution_id = undefined;
      data.department_id = undefined;
    }

    // Check uniqueness
    const existing = await this.prisma.userAuth.findUnique({
      where: { email_id: data.email_id },
    });
    if (existing) {
      throw new ConflictException('An account with this email already exists.');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(data.password, SALT_ROUNDS);

    // Create user
    const user = await this.prisma.userAuth.create({
      data: {
        user_name: data.user_name,
        email_id: data.email_id,
        password: hashedPassword,
        role: data.role,
        institution_id: data.institution_id || null,
        department_id: data.department_id || null,
      },
      include: {
        institution: true,
        department: true,
      },
    });

    // Exclude password from response
    const { password, ...result } = user;
    void password;
    return result;
  }

  async signin(email_id: string, password: string) {
    const user = await this.prisma.userAuth.findUnique({
      where: { email_id },
      include: {
        institution: true,
        department: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    if (!user.is_active) {
      throw new UnauthorizedException('Account is deactivated. Contact admin.');
    }

    const passwordValid = await bcrypt.compare(password, user.password);
    if (!passwordValid) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    const { password: userPassword, ...result } = user;
    void userPassword;
    return result;
  }

  async findAll() {
    const users = await this.prisma.userAuth.findMany({
      include: {
        institution: true,
        department: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return users.map((u) => {
      const { password, ...rest } = u;
      void password;
      return rest;
    });
  }
}
