import { DataTypes, Model, Op, Sequelize } from "sequelize";

import { getConnectionString, getSslConfig } from "@/lib/postgres";

declare global {
  // eslint-disable-next-line no-var
  var sequelize: Sequelize | undefined;
}

export const sequelize =
  globalThis.sequelize ??
  new Sequelize(getConnectionString(), {
    dialect: "postgres",
    logging: process.env.SEQUELIZE_LOGGING === "true" ? console.log : false,
    dialectOptions: getSslConfig()
      ? {
          ssl: getSslConfig(),
        }
      : undefined,
  });

if (process.env.NODE_ENV !== "production") {
  globalThis.sequelize = sequelize;
}

export class Product extends Model {
  declare id: number;
  declare slug: string;
  declare title: string;
  declare description_html: string | null;
  declare price_cents: number;
  declare compare_at_cents: number | null;
  declare active: boolean;
  declare in_stock: boolean;
  declare created_at: Date;
  declare updated_at: Date;
}

Product.init(
  {
    id: {
      type: DataTypes.BIGINT,
      autoIncrement: true,
      primaryKey: true,
    },
    slug: {
      type: DataTypes.TEXT,
      allowNull: false,
      unique: true,
    },
    title: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    description_html: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    price_cents: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    compare_at_cents: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    in_stock: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    created_at: {
      type: DataTypes.DATE,
    },
    updated_at: {
      type: DataTypes.DATE,
    },
  },
  {
    sequelize,
    tableName: "products",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  },
);

export class ProductImage extends Model {
  declare id: number;
  declare product_id: number;
  declare url: string;
  declare position: number;
  declare created_at: Date;
}

ProductImage.init(
  {
    id: {
      type: DataTypes.BIGINT,
      autoIncrement: true,
      primaryKey: true,
    },
    product_id: {
      type: DataTypes.BIGINT,
      allowNull: false,
    },
    url: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    position: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    created_at: {
      type: DataTypes.DATE,
    },
  },
  {
    sequelize,
    tableName: "product_images",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: false,
  },
);

export class ProductOption extends Model {
  declare id: number;
  declare product_id: number;
  declare name: string;
  declare position: number;
  declare created_at: Date;
}

ProductOption.init(
  {
    id: {
      type: DataTypes.BIGINT,
      autoIncrement: true,
      primaryKey: true,
    },
    product_id: {
      type: DataTypes.BIGINT,
      allowNull: false,
    },
    name: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    position: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    created_at: {
      type: DataTypes.DATE,
    },
  },
  {
    sequelize,
    tableName: "product_options",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: false,
  },
);

export class ProductOptionValue extends Model {
  declare id: number;
  declare option_id: number;
  declare value: string;
  declare position: number;
  declare created_at: Date;
}

ProductOptionValue.init(
  {
    id: {
      type: DataTypes.BIGINT,
      autoIncrement: true,
      primaryKey: true,
    },
    option_id: {
      type: DataTypes.BIGINT,
      allowNull: false,
    },
    value: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    position: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    created_at: {
      type: DataTypes.DATE,
    },
  },
  {
    sequelize,
    tableName: "product_option_values",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: false,
  },
);

export class WebsiteSetting extends Model {
  declare id: number;
  declare store_name: string;
  declare domain: string | null;
  declare website_title: string | null;
  declare website_description: string | null;
  declare default_currency: string;
  declare logo_url: string | null;
  declare logo_transparent_url: string | null;
  declare brevo_api_key: string | null;
  declare created_at: Date;
  declare updated_at: Date;
}

WebsiteSetting.init(
  {
    id: {
      type: DataTypes.BIGINT,
      autoIncrement: true,
      primaryKey: true,
    },
    store_name: {
      type: DataTypes.TEXT,
      allowNull: false,
      defaultValue: "",
    },
    domain: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    website_title: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    website_description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    default_currency: {
      type: DataTypes.TEXT,
      allowNull: false,
      defaultValue: "EUR",
    },
    logo_url: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    logo_transparent_url: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    brevo_api_key: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    created_at: {
      type: DataTypes.DATE,
    },
    updated_at: {
      type: DataTypes.DATE,
    },
  },
  {
    sequelize,
    tableName: "website_settings",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  },
);

export class Collection extends Model {
  declare id: number;
  declare slug: string;
  declare title: string;
  declare description: string | null;
  declare image_url: string | null;
  declare listing_active: boolean;
  declare created_at: Date;
  declare updated_at: Date;
}

Collection.init(
  {
    id: {
      type: DataTypes.BIGINT,
      autoIncrement: true,
      primaryKey: true,
    },
    slug: {
      type: DataTypes.TEXT,
      allowNull: false,
      unique: true,
    },
    title: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    image_url: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    listing_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    created_at: {
      type: DataTypes.DATE,
    },
    updated_at: {
      type: DataTypes.DATE,
    },
  },
  {
    sequelize,
    tableName: "collections",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  },
);

export class ProductCollection extends Model {
  declare id: number;
  declare product_id: number;
  declare collection_id: number;
  declare created_at: Date;
}

ProductCollection.init(
  {
    id: {
      type: DataTypes.BIGINT,
      autoIncrement: true,
      primaryKey: true,
    },
    product_id: {
      type: DataTypes.BIGINT,
      allowNull: false,
    },
    collection_id: {
      type: DataTypes.BIGINT,
      allowNull: false,
    },
    created_at: {
      type: DataTypes.DATE,
    },
  },
  {
    sequelize,
    tableName: "product_collections",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: false,
  },
);

export class DiscountCode extends Model {
  declare id: number;
  declare code: string;
  declare discount_type: string;
  declare amount_cents: number | null;
  declare percent_off: number | null;
  declare active: boolean;
  declare created_at: Date;
  declare updated_at: Date;
}

DiscountCode.init(
  {
    id: {
      type: DataTypes.BIGINT,
      autoIncrement: true,
      primaryKey: true,
    },
    code: {
      type: DataTypes.TEXT,
      allowNull: false,
      unique: true,
    },
    discount_type: {
      type: DataTypes.ENUM("fixed", "percent"),
      allowNull: false,
      defaultValue: "fixed",
    },
    amount_cents: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    percent_off: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    created_at: {
      type: DataTypes.DATE,
    },
    updated_at: {
      type: DataTypes.DATE,
    },
  },
  {
    sequelize,
    tableName: "discount_codes",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  },
);

export class Order extends Model {
  declare id: number;
  declare public_id: string;
  declare status: string;
  declare first_name: string;
  declare last_name: string;
  declare email: string;
  declare phone: string | null;
  declare address1: string;
  declare address2: string | null;
  declare postal_code: string;
  declare city: string;
  declare country: string;
  declare preferred_payment_method: string;
  declare subtotal_cents: number;
  declare shipping_cents: number;
  declare discount_code_id: number | null;
  declare discount_cents: number | null;
  declare total_cents: number;
  declare paid_at: Date | null;
  declare created_at: Date;
  declare updated_at: Date;
}

Order.init(
  {
    id: {
      type: DataTypes.BIGINT,
      autoIncrement: true,
      primaryKey: true,
    },
    public_id: {
      type: DataTypes.TEXT,
      allowNull: false,
      unique: true,
    },
    status: {
      type: DataTypes.ENUM(
        "pending_payment",
        "payment_link_sent",
        "paid",
        "fulfilled",
        "cancelled",
      ),
      allowNull: false,
      defaultValue: "pending_payment",
    },
    first_name: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    last_name: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    email: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    phone: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    address1: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    address2: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    postal_code: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    city: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    country: {
      type: DataTypes.TEXT,
      allowNull: false,
      defaultValue: "FR",
    },
    preferred_payment_method: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    subtotal_cents: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    shipping_cents: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    discount_code_id: {
      type: DataTypes.BIGINT,
      allowNull: true,
    },
    discount_cents: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    total_cents: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    paid_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    created_at: {
      type: DataTypes.DATE,
    },
    updated_at: {
      type: DataTypes.DATE,
    },
  },
  {
    sequelize,
    tableName: "orders",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  },
);

export class OrderItem extends Model {
  declare id: number;
  declare order_id: number;
  declare product_id: number | null;
  declare title_snapshot: string;
  declare unit_price_cents_snapshot: number;
  declare qty: number;
}

OrderItem.init(
  {
    id: {
      type: DataTypes.BIGINT,
      autoIncrement: true,
      primaryKey: true,
    },
    order_id: {
      type: DataTypes.BIGINT,
      allowNull: false,
    },
    product_id: {
      type: DataTypes.BIGINT,
      allowNull: true,
    },
    title_snapshot: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    unit_price_cents_snapshot: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    qty: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
  },
  {
    sequelize,
    tableName: "order_items",
    timestamps: false,
  },
);


Product.hasMany(ProductImage, { foreignKey: "product_id", as: "images" });
ProductImage.belongsTo(Product, { foreignKey: "product_id", as: "product" });

Product.hasMany(ProductOption, { foreignKey: "product_id", as: "options" });
ProductOption.belongsTo(Product, { foreignKey: "product_id", as: "product" });
ProductOption.hasMany(ProductOptionValue, {
  foreignKey: "option_id",
  as: "values",
});
ProductOptionValue.belongsTo(ProductOption, {
  foreignKey: "option_id",
  as: "option",
});

Product.belongsToMany(Collection, {
  through: ProductCollection,
  foreignKey: "product_id",
  otherKey: "collection_id",
  as: "collections",
});
Collection.belongsToMany(Product, {
  through: ProductCollection,
  foreignKey: "collection_id",
  otherKey: "product_id",
  as: "products",
});
ProductCollection.belongsTo(Product, { foreignKey: "product_id" });
ProductCollection.belongsTo(Collection, { foreignKey: "collection_id" });

DiscountCode.hasMany(Order, {
  foreignKey: "discount_code_id",
  as: "orders",
});
Order.belongsTo(DiscountCode, {
  foreignKey: "discount_code_id",
  as: "discount",
});

Order.hasMany(OrderItem, { foreignKey: "order_id", as: "items" });
OrderItem.belongsTo(Order, { foreignKey: "order_id", as: "order" });

export { Op };
